const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 转义搜索词中的正则特殊字符，避免 db.RegExp 构造抛异常（用户输入含 ( [ * ? 等会 500）
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  const openid = OPENID
  
  // 如果是后台调用（OPENID 为空），跳过权限校验
  if (!openid) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0, user: { permissions: [permission], role: 'admin' } }
  }
  
  const userResult = await db.collection('users').where({ openid }).get()
  if (userResult.data.length === 0) {
    // 未注册用户不自动提权：管理员创建统一走 auth.login 的「零配置首管理员」逻辑
    return { code: 401, message: '用户不存在，请先登录' }
  }
  
  const user = userResult.data[0]
  if (user.role === 'admin') {
    return { code: 0, user }
  }
  
  if (user.permissions && user.permissions.includes(permission)) {
    return { code: 0, user }
  }
  
  return { code: 403, message: '无权限访问' }
}

// 追加订单操作记录（对齐原型 renderOrderLogs / 订单修改历史）
async function getUserIdentity() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { name: '系统', role: 'system' }
  try {
    const r = await db.collection('users').where({ openid: OPENID }).get()
    if (r.data && r.data.length > 0) {
      const u = r.data[0]
      return { name: u.name || '未知', role: u.role || 'orderer' }
    }
  } catch (e) { console.error('获取用户身份失败', e) }
  return { name: '未知', role: 'orderer' }
}

async function appendLog(orderId, action, desc) {
  if (!orderId) return
  try {
    const identity = await getUserIdentity()
    const logEntry = {
      action,
      desc,
      operatorName: identity.name,
      role: identity.role,
      time: Date.now()
    }
    await db.collection('orders').doc(orderId).update({
      data: {
        logs: db.command.push([logEntry])
      }
    })
  } catch (e) {
    console.error('记录订单操作日志失败', e)
  }
}

exports.main = async (event, context) => {
  const { action } = event
  
  // 权限映射
  const permissionMap = {
    'create': 'order:create',
    'list': 'order:view',
    'detail': 'order:view',
    'update-status': 'order:edit',
    'update': 'order:edit',
    'delete': 'order:delete',
    'todayStats': 'report:view',
    'lastOrder': 'order:view',
    'markShared': 'order:print',
    'outboundList': 'warehouse:confirm',
    'confirmSort': 'sort:task',
    'confirmOut': 'warehouse:confirm',
    'exportOutbound': 'warehouse:confirm',
  }
  
  // 如果 action 不在权限映射中，跳过权限校验
  if (!permissionMap[action]) {
    console.log(`⚠️ action "${action}" 无权限映射，跳过权限校验`)
  } else {
    // outboundList 为分拣/出库共用列表接口，按前端页面守卫口径：sort:task 或 warehouse:confirm 任一即可
    if (action === 'outboundList') {
      const r1 = await checkPermission('sort:task')
      if (r1.code !== 0) {
        const r2 = await checkPermission('warehouse:confirm')
        if (r2.code !== 0) return r2
      }
    } else {
      const permission = permissionMap[action]
      const authResult = await checkPermission(permission)
      if (authResult.code !== 0) {
        return authResult
      }
    }
  }
  
  switch (action) {
    case 'create': {
      const { customerId, customerName, items, customerRegion } = event
      const totalAmount = Number(event.totalAmount) || 0
      if (totalAmount <= 0) return { code: 2001, message: '订单金额不能为 0' }

      // 归一化 items：补齐 qty/price/amount 展示字段（兼容详情/送货单/报表），保留件包双轨字段
      const normalizedItems = (items || []).map(it => {
        const mode = it.pricing_mode || 'case'
        const pieceQty = it.piece_qty || 0
        const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
        const pricePiece = it.price_piece || 0
        const priceUnit = it.price_unit != null ? it.price_unit : (it.price_zero || 0)
        let amount = 0
        if (mode === 'piece') amount = pieceQty * pricePiece
        else if (mode === 'unit') amount = packageQty * priceUnit
        else amount = pieceQty * pricePiece + packageQty * priceUnit
        // 兼容旧字段
        const qty = Math.max(pieceQty, packageQty) || it.qty || 0
        const price = (it.price_piece != null && it.price_piece !== 0) ? pricePiece : (priceUnit || it.price || 0)
        return Object.assign({}, it, { qty, price, amount })
      })
      const today = new Date()
      const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0')
      const count = await db.collection('orders').where({ orderNo: db.RegExp({ regexp: `丰淮商贸-${dateStr}`, options: 'i' }) }).count()
      const orderNo = `丰淮商贸-${dateStr}-${(count.total + 1).toString().padStart(4, '0')}`
      const order = {
        orderNo, customerId, customerName, customerRegion: customerRegion || '', items: normalizedItems,
        totalAmount, status: 'submitted',
        payment_status: 'unpaid', paymentStatus: 'unpaid',
        received_amount: 0, receivedAmount: 0,
        sortStatus: 'pending', outStatus: 'pending',
        created_at: db.serverDate()
      }
      // 记录下单员（创建人），供订单详情展示
      try {
        const identity = await getUserIdentity()
        if (identity) {
          order.createdByName = identity.name
          order.createdByRole = identity.role
        }
      } catch (e) { console.error('记录下单员失败', e) }
      const res = await db.collection('orders').add({ data: order })
      await appendLog(res._id, 'create', '创建订单')
      return { code: 0, data: { _id: res._id, orderNo } }
    }
    case 'list': {
      const { timeTab, searchKey } = event
      // 合并搜索词与时间过滤为单次 where：多次链式 .where() 会互相覆盖，导致两者无法同时生效
      const conditions = []
      if (searchKey) {
        conditions.push(db.command.or([
          { orderNo: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { customerName: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) }
        ]))
      }
      const now = new Date()
      if (timeTab === 'today') {
        const today = new Date(); today.setHours(0,0,0,0)
        conditions.push({ created_at: db.command.gte(today) })
      } else if (timeTab === 'week') {
        const day = now.getDay() || 7
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
        start.setHours(0,0,0,0)
        conditions.push({ created_at: db.command.gte(start) })
      } else if (timeTab === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        conditions.push({ created_at: db.command.gte(start) })
      }
      let query = db.collection('orders')
      if (conditions.length === 1) {
        query = query.where(conditions[0])
      } else if (conditions.length > 1) {
        query = query.where(db.command.and(conditions))
      }
      const res = await query.orderBy('created_at', 'desc').limit(200).get()
      return { code: 0, data: res.data }
    }
    case 'detail': {
      // 兼容 id 和 orderId 两种参数
      const orderId = event.orderId || event.id
      if (!orderId) {
        return { code: 5001, message: '缺少订单 ID 参数' }
      }
      const res = await db.collection('orders').doc(orderId).get()
      const order = res.data
      // 关联客户资料（电话/地址/联系人）+ 累计欠款，供打印/送货单模板使用
      if (order && order.customerId) {
        try {
          const cRes = await db.collection('customers').doc(order.customerId).get()
          const c = cRes.data
          if (c) {
            order.customerPhone = c.phone || ''
            order.customerRegion = c.region || ''
            order.customerContact = c.contact || ''
            order.customerAddress = c.address || c.region || ''
          }
        } catch (e) {
          console.error('加载客户资料失败', e)
        }
        // 累计欠款 = 该客户所有未结清订单（paid 之外）的剩余欠款之和
        try {
          const unpaid = await db.collection('orders')
            .where({
              customerId: order.customerId,
              paymentStatus: db.command.in(['unpaid', 'pending', 'partial'])
            })
            .get()
          const totalDebt = unpaid.data.reduce((sum, o) => {
            const received = o.received_amount || o.receivedAmount || 0
            const discount = o.total_discount || o.totalDiscount || 0
            return sum + Math.max(0, (o.totalAmount || 0) - received - discount)
          }, 0)
          order.totalDebt = totalDebt
        } catch (e) {
          console.error('计算累计欠款失败', e)
          order.totalDebt = 0
        }
      }
      return { code: 0, data: order }
    }
    // 取某客户最近一笔订单（用于下单时带出上次价格/商品）
    case 'lastOrder': {
      const { customerId } = event
      if (!customerId) return { code: 2002, message: '缺少客户 ID' }
      const res = await db.collection('orders')
        .where({ customerId })
        .orderBy('created_at', 'desc')
        .limit(1)
        .get()
      const order = res.data[0] || null
      return { code: 0, data: order ? order.items || [] : [] }
    }
    case 'update': {
      const { orderId, items, customerName, customerRegion } = event
      const totalAmount = Number(event.totalAmount) || 0
      if (!orderId) return { code: 2002, message: '缺少订单 ID' }
      if (totalAmount <= 0) return { code: 2001, message: '订单金额不能为 0' }
      const normalizedItems = (items || []).map(it => {
        const mode = it.pricing_mode || 'case'
        const pieceQty = it.piece_qty || 0
        const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
        const pricePiece = it.price_piece || 0
        const priceUnit = it.price_unit != null ? it.price_unit : (it.price_zero || 0)
        let amount = 0
        if (mode === 'piece') amount = pieceQty * pricePiece
        else if (mode === 'unit') amount = packageQty * priceUnit
        else amount = pieceQty * pricePiece + packageQty * priceUnit
        const qty = Math.max(pieceQty, packageQty) || it.qty || 0
        // 单价口径与 create 一致：case 模式存件价，其余按模式对应单价
        const price = (it.price_piece != null && it.price_piece !== 0) ? pricePiece : (priceUnit || it.price || 0)
        return Object.assign({}, it, { qty, price, amount })
      })
      const patch = { items: normalizedItems, customerRegion: customerRegion || '', totalAmount, status: 'submitted', sortStatus: 'pending', outStatus: 'pending' }
      if (customerName) patch.customerName = customerName
      await db.collection('orders').doc(orderId).update({ data: patch })
      await appendLog(orderId, 'update', '编辑订单')
      return { code: 0, data: {} }
    }
    case 'update-status': {
      await db.collection('orders').doc(event.orderId).update({ data: { status: event.status } })
      return { code: 0, data: {} }
    }
    case 'delete': {
      await appendLog(event.orderId, 'delete', '删除订单')
      await db.collection('orders').doc(event.orderId).remove()
      // 级联清理该订单的收款记录（付款单），避免孤儿数据残留「待确认收款」工作台
      try {
        const pays = await db.collection('payments').where({
          orderId: event.orderId
        }).get()
        await Promise.all(pays.data.map(p => db.collection('payments').doc(p._id).remove()))
      } catch (e) { console.error('清理订单收款记录失败', e) }
      return { code: 0, data: {} }
    }
    case 'todayStats': {
      const today = new Date(); today.setHours(0,0,0,0)
      const res = await db.collection('orders').where({ created_at: db.command.gte(today) }).get()
      let amount = 0
      res.data.forEach(o => { amount += Number(o.totalAmount) || 0 })
      return { code: 0, data: { count: res.data.length, amount } }
    }
    case 'outboundList': {
      const { subTab } = event
      if (subTab === 'sort') {
        const res = await db.collection('orders').where({ sortStatus: 'pending' }).orderBy('created_at', 'desc').limit(100).get()
        return { code: 0, data: { pendingSort: res.data, pendingOut: [] } }
      }
      // 出库工作台：库管不等分拣完成，所有未出库订单都可见（与分拣并行）
      const pendingRes = await db.collection('orders').where({ outStatus: 'pending' }).orderBy('created_at', 'desc').limit(100).get()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const doneRes = await db.collection('orders')
        .where({ outStatus: 'done', created_at: db.command.gte(today) })
        .orderBy('created_at', 'desc').limit(100).get()
      return { code: 0, data: { pendingOut: pendingRes.data, doneOut: doneRes.data } }
    }
    case 'confirmSort': {
      const { orderId, batchMode } = event
      // status 由 分拣+出库 双状态派生：出库已完成=confirmed，否则=sorted（并行下避免把已出库订单降级）
      const deriveStatusAfterSort = (o) => (o && o.outStatus === 'done') ? 'confirmed' : 'sorted'
      if (batchMode) {
        const list = await db.collection('orders').where({ sortStatus: 'pending' }).get()
        for (const it of list.data) {
          await db.collection('orders').doc(it._id).update({
            data: { sortStatus: 'done', sortTime: db.serverDate(), status: deriveStatusAfterSort(it) }
          })
        }
      } else {
        const cur = await db.collection('orders').doc(orderId).get()
        await db.collection('orders').doc(orderId).update({
          data: { sortStatus: 'done', sortTime: db.serverDate(), status: deriveStatusAfterSort(cur.data) }
        })
        await appendLog(orderId, 'sort', '完成分拣')
      }
      return { code: 0, data: {} }
    }
    case 'markShared': {
      // 标记订单已转发到微信
      const { orderId } = event
      await db.collection('orders').doc(orderId).update({
        data: {
          shared_to_wechat: true,
          shared_at: db.serverDate()
        }
      })
      await appendLog(orderId, 'share', '转发销售单到微信')
      return { code: 0, data: {} }
    }
    case 'confirmOut': {
      const { orderId, batchMode, ship_large, ship_medium, ship_small } = event
      const sl = typeof ship_large === 'number' ? ship_large : 0
      const sm = typeof ship_medium === 'number' ? ship_medium : 0
      const ss = typeof ship_small === 'number' ? ship_small : 0
      // 库管出库不依赖分拣完成；status 由 分拣+出库 双状态派生：分拣已完成=confirmed，否则=sorted
      const deriveStatusAfterOut = (o) => (o && o.sortStatus === 'done') ? 'confirmed' : 'sorted'
      if (batchMode) {
        const list = await db.collection('orders').where({ outStatus: 'pending' }).get()
        for (const it of list.data) {
          await db.collection('orders').doc(it._id).update({
            data: { outStatus: 'done', ship_large: sl, ship_medium: sm, ship_small: ss, outTime: db.serverDate(), status: deriveStatusAfterOut(it) }
          })
        }
      } else {
        const cur = await db.collection('orders').doc(orderId).get()
        await db.collection('orders').doc(orderId).update({
          data: { outStatus: 'done', ship_large: sl, ship_medium: sm, ship_small: ss, outTime: db.serverDate(), status: deriveStatusAfterOut(cur.data) }
        })
        await appendLog(orderId, 'out', '确认出库')
      }
      return { code: 0, data: {} }
    }
    case 'exportOutbound': {
      // 导出库单（不含价格，含大/中/小件）— 对标原型 exportWarehouseOut
      const today = new Date(); today.setHours(0,0,0,0)
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0)
      const { exportAll = false } = event
      const res = await db.collection('orders')
        .where({
          outStatus: 'done',
          created_at: db.command.gte(today).and(db.command.lt(tomorrow))
        })
        .orderBy('created_at', 'desc')
        .get()
      const orders = res.data
      const rows = []
      let no = 1
      let currentCustomer = ''
      orders.forEach(o => {
        if (o.customerName !== currentCustomer) {
          currentCustomer = o.customerName
          rows.push([no++, '', '', '', o.customerName, '', '', '', '', '', '', ''])
        }
        const pkg = { big: o.ship_large||0, medium: o.ship_medium||0, small: o.ship_small||0 }
        let firstItem = true
        ;(o.items || []).forEach(it => {
          const pieceQty = it.piece_qty || 0
          const zeroQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
          const pushRow = (unit, qty) => {
            const big = firstItem ? pkg.big : ''
            const mid = firstItem ? pkg.medium : ''
            const small = firstItem ? pkg.small : ''
            const timeStr = o.created_at ? new Date(o.created_at).toTimeString().slice(0,5) : ''
            rows.push(['', timeStr, o.customerRegion || '', o.orderNo, '', it.name, unit, qty, it.remark || '', big, mid, small])
            firstItem = false
          }
          if (pieceQty > 0) pushRow('件', pieceQty)
          if (zeroQty > 0) pushRow('包', zeroQty)
        })
      })
      const header = ['编号','时间','区域','订单号','客户','商品','单位','数量','备注','大件数','中件数','小件数']
      // 防 CSV 公式注入：Excel 打开时将 = + - @ 开头单元格前缀 ' 转文本
      const sanitizeCell = (v) => {
        if (v === null || v === undefined) return ''
        let s = String(v)
        if (/^[=+\-@]/.test(s)) s = "'" + s
        return s
      }
      const csvRows = [header, ...rows]
      const csvContent = csvRows.map(r => (r||[]).map(sanitizeCell).join(',')).join('\n')
      const filename = '出库单_' + new Date().toISOString().split('T')[0] + '.csv'
      return { code: 0, data: { csvContent, filename, count: orders.length } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
