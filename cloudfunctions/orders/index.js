const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
    // 如果没有用户数据，自动创建管理员
    try {
      await db.collection('users').add({
        data: {
          openid,
          name: '管理员',
          role: 'admin',
          phone: '',
          permissions: ['product:view', 'product:edit', 'customer:view', 'customer:edit', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export', 'sort:task', 'warehouse:confirm', 'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount', 'report:view', 'report:export', 'report:ledger', 'member:manage'],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, user: { permissions: [permission] } }
    } catch (e) {
      console.error('创建管理员失败:', e)
      return { code: 401, message: '用户不存在且创建失败' }
    }
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
    const permission = permissionMap[action]
    const authResult = await checkPermission(permission)
    if (authResult.code !== 0) {
      return authResult
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
      let query = db.collection('orders')
      if (searchKey) {
        query = query.where(db.command.or([
          { orderNo: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { customerName: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      const now = new Date()
      if (timeTab === 'today') {
        const today = new Date(); today.setHours(0,0,0,0)
        query = query.where({ created_at: db.command.gte(today) })
      } else if (timeTab === 'week') {
        const day = now.getDay() || 7
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
        start.setHours(0,0,0,0)
        query = query.where({ created_at: db.command.gte(start) })
      } else if (timeTab === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        query = query.where({ created_at: db.command.gte(start) })
      }
      const res = await query.orderBy('created_at', 'desc').limit(200).get()
      return { code: 0, data: res.data }
    }
    case 'detail': {
      const res = await db.collection('orders').doc(event.orderId).get()
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
      let query = db.collection('orders')
      
      if (subTab === 'sort') {
        query = query.where({ sortStatus: 'pending' })
      } else if (subTab === 'out') {
        query = query.where({ 
          sortStatus: 'done',
          outStatus: 'pending'
        })
      }
      
      const res = await query.orderBy('created_at', 'desc').limit(100).get()
      const list = res.data
      // 前端按 workbench 分别读取 pendingSort / pendingOut
      return {
        code: 0,
        data: subTab === 'out'
          ? { pendingSort: [], pendingOut: list }
          : { pendingSort: list, pendingOut: [] }
      }
    }
    case 'confirmSort': {
      const { orderId, batchMode } = event
      
      if (batchMode) {
        await db.collection('orders').where({ sortStatus: 'pending' }).update({
          data: { 
            sortStatus: 'done',
            sortTime: db.serverDate(),
            status: 'sorted'
          }
        })
      } else {
        await db.collection('orders').doc(orderId).update({
          data: { 
            sortStatus: 'done',
            sortTime: db.serverDate(),
            status: 'sorted'
          }
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
      
      if (batchMode) {
        await db.collection('orders').where({ 
          sortStatus: 'done',
          outStatus: 'pending'
        }).update({
          data: { 
            outStatus: 'done',
            ship_large: typeof ship_large === 'number' ? ship_large : 0,
            ship_medium: typeof ship_medium === 'number' ? ship_medium : 0,
            ship_small: typeof ship_small === 'number' ? ship_small : 0,
            outTime: db.serverDate(),
            status: 'confirmed'
          }
        })
      } else {
        await db.collection('orders').doc(orderId).update({
          data: { 
            outStatus: 'done',
            ship_large: typeof ship_large === 'number' ? ship_large : 0,
            ship_medium: typeof ship_medium === 'number' ? ship_medium : 0,
            ship_small: typeof ship_small === 'number' ? ship_small : 0,
            outTime: db.serverDate(),
            status: 'confirmed'
          }
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
      const csvRows = [header, ...rows]
      const csvContent = csvRows.map(r => (r||[]).map(c => c === null || c === undefined ? '' : String(c)).join(',')).join('\n')
      const filename = '出库单_' + new Date().toISOString().split('T')[0] + '.csv'
      return { code: 0, data: { csvContent, filename, count: orders.length } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
