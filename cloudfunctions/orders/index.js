const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null

const XLSX = require('xlsx')

// 公司名（用于导出标题；云函数无法 require 前端 constants）
const COMPANY_NAME = '丰淮商贸'
function salesTitle(o){ return (o && (o.customerName || o.customer) || COMPANY_NAME) + '食品销售单' }

// 本地数量文案（云函数无法 require 前端 utils，内联精简版）
function qtyDescLocal(it) {
  const pieceQty = it.piece_qty || 0
  const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
  const u = String(it.unit || '').split('/')
  const zeroUnit = u[0] || '包'
  const mode = it.pricing_mode || 'case'
  if (mode === 'piece') return pieceQty > 0 ? pieceQty + '件' : ''
  if (mode === 'unit') return packageQty > 0 ? packageQty + zeroUnit : ''
  if (pieceQty > 0 && packageQty > 0) return pieceQty + '件+' + packageQty + zeroUnit
  if (pieceQty > 0) return pieceQty + '件'
  if (packageQty > 0) return packageQty + zeroUnit
  return ''
}

// 由二维数组生成 xlsx buffer（数字列保持数值，文本保持文本）
function buildXlsxBuffer(rows, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows || [])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// 导出内容统一出口：format=excel 时生成 xlsx 上传云存储返回 fileID；否则返回 csvContent
async function buildExport(rows, baseName, opts) {
  const fmt = opts.format === 'excel' ? 'excel' : 'csv'
  if (fmt === 'excel') {
    const buffer = buildXlsxBuffer(rows, opts.sheetName || 'Sheet1')
    const safeName = String(baseName || 'export').replace(/\//g, '')
    const cloudPath = 'exports/' + safeName + '_' + Date.now() + '.xlsx'
    const up = await cloud.uploadFile({ cloudPath, fileContent: buffer })
    return { format: 'excel', fileID: up.fileID, filename: safeName + '.xlsx' }
  }
  const csvContent = (rows || []).map(row => (row || []).map(c => {
    let v = c === null || c === undefined ? '' : String(c)
    if (/^[=+\-@]/.test(v)) v = "'" + v
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }).join(',')).join('\n')
  return { format: 'csv', csvContent, filename: baseName + '.csv' }
}

// 转义搜索词中的正则特殊字符，避免 db.RegExp 构造抛异常（用户输入含 ( [ * ? 等会 500）
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  const openid = __impersonatedOpenid || OPENID
  
//   安全加固：无身份(空openid)一律拒绝——原"后台调用放行admin"为越权漏洞；内部定时 action 不走权限映射，不受影响
  if (!openid) { return { code: 401, message: '无法获取用户身份，请在小程序内访问' } }
  
  const userResult = await db.collection('users').where({ openid }).get()
  if (userResult.data.length === 0) {
    // 未注册用户不自动提权：管理员创建统一走 auth.login 的「零配置首管理员」逻辑
    return { code: 401, message: '用户不存在，请先登录' }
  }
  
  const user = userResult.data[0]
  if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }

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

// ============ 定时自动确认（管理员可控） ============
// 读 system_config 的 autoConfirm { enabled, time }（后台调用无 OPENID，直接读）
async function getAutoConfirmCfg() {
  try {
    const res = await db.collection('system_config').doc('global').get()
    const ac = (res.data && res.data.autoConfirm) || {}
    return { enabled: !!ac.enabled, time: ac.time || '16:00' }
  } catch (e) {
    return { enabled: false, time: '16:00' }
  }
}
// 今天是否已跑过（幂等：一天只触发一次，改时间不重复确认）
async function todayAutoMark() {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  try {
    const res = await db.collection('auto_confirm_log').where({ runDate: t.getTime() }).limit(1).get()
    return res.data && res.data[0]
  } catch (e) {
    return null // 集合尚未创建时视为未跑过
  }
}
// 确保日志集合存在（首次运行自动创建；失败静默）
async function ensureLogCollection() {
  try { await db.createCollection('auto_confirm_log') } catch (e) { /* 已存在则忽略 */ }
}
async function markAutoRan(type, detail) {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const rec = { runDate: t.getTime(), time: Date.now(), type: type, detail: detail || {} }
  await ensureLogCollection()
  try {
    const cur = await todayAutoMark()
    if (cur) await db.collection('auto_confirm_log').doc(cur._id).update({ data: rec })
    else await db.collection('auto_confirm_log').add({ data: rec })
  } catch (e) { /* 记录失败不阻断 */ }
}
// 把当天未人工确认的分拣/出库订单全部置 done（status 双状态派生；库管不依赖分拣）
async function runAutoConfirm() {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  let sortN = 0, outN = 0
  const sortRes = await db.collection('orders')
    .where({ sortStatus: 'pending', created_at: db.command.gte(t) }).limit(500).get()
  for (const it of sortRes.data) {
    const derive = (it.outStatus === 'done') ? 'confirmed' : 'sorted'
    await db.collection('orders').doc(it._id).update({
      data: { sortStatus: 'done', sortTime: db.serverDate(), autoConfirmed: true, status: derive }
    })
    sortN++
  }
  const outRes = await db.collection('orders')
    .where({ outStatus: 'pending', created_at: db.command.gte(t) }).limit(500).get()
  for (const it of outRes.data) {
    const derive = (it.sortStatus === 'done') ? 'confirmed' : 'sorted'
    await db.collection('orders').doc(it._id).update({
      data: { outStatus: 'done', outTime: db.serverDate(), autoConfirmed: true, status: derive }
    })
    outN++
  }
  return { sortN, outN }
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
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
      // 过滤 0件0包 的商品行
      const validItems = normalizedItems.filter(it => (it.piece_qty || 0) > 0 || (it.package_qty != null ? it.package_qty : (it.zero_qty || 0)) > 0)
      // 0 金额拦截：有效商品为空、或所有物品金额合计为 0（物品行未带金额）→ 订单不生成
      const itemsSum = validItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
      if (!validItems.length) return { code: 2001, message: '订单商品数量必须大于 0' }
      if (itemsSum <= 0) return { code: 2001, message: '订单金额必须大于 0，请检查商品数量/单价' }
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
      let order
      try {
        order = (await db.collection('orders').doc(orderId).get()).data
      } catch (e) {
        return { code: 404, message: '订单不存在' }
      }
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
              paymentStatus: db.command.in(['unpaid', 'pending'])
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
      // 与 create 一致：0件0包 过滤 + 0 金额拦截
      const validItems2 = normalizedItems.filter(it => (it.piece_qty || 0) > 0 || (it.package_qty != null ? it.package_qty : (it.zero_qty || 0)) > 0)
      const itemsSum2 = validItems2.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
      if (!validItems2.length) return { code: 2001, message: '订单商品数量必须大于 0' }
      if (itemsSum2 <= 0) return { code: 2001, message: '订单金额必须大于 0，请检查商品数量/单价' }
      const patch = { items: validItems2, customerRegion: customerRegion || '', totalAmount, status: 'submitted', sortStatus: 'pending', outStatus: 'pending' }
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
      const { timeTab = 'today', startDate: customStart, endDate: customEnd } = event
      const where = { outStatus: 'done' }
      if (timeTab === 'custom' && customStart && customEnd) {
        const start = new Date(customStart); start.setHours(0,0,0,0)
        const end = new Date(customEnd); end.setHours(23,59,59,999)
        where.created_at = db.command.and([db.command.gte(start), db.command.lte(end)])
      } else if (timeTab === 'all') {
        // 全部：不限时间
      } else {
        const today = new Date(); today.setHours(0,0,0,0)
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0)
        where.created_at = db.command.and([db.command.gte(today), db.command.lt(tomorrow)])
      }
      const res = await db.collection('orders')
        .where(where)
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
        // 物流件数：0 不显示（与界面一致），导出留空
        const pkg = { big: o.ship_large||0, medium: o.ship_medium||0, small: o.ship_small||0 }
        const pkgShow = v => (v > 0 ? v : '')
        let firstItem = true
        ;(o.items || []).forEach(it => {
          // 旧格式数据回退：无 piece_qty/package_qty 但有 qty/price 时按 件×单价 展示
          let pieceQty = it.piece_qty || 0
          let zeroQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
          if (pieceQty <= 0 && zeroQty <= 0 && (it.qty || 0) > 0) { pieceQty = it.qty; }
          const pushRow = (unit, qty) => {
            const big = firstItem ? pkgShow(pkg.big) : ''
            const mid = firstItem ? pkgShow(pkg.medium) : ''
            const small = firstItem ? pkgShow(pkg.small) : ''
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
      const rangeTxt = (timeTab === 'custom' && customStart && customEnd) ? (customStart + '_' + customEnd) : (timeTab === 'all' ? '全部' : '今日')
      const baseName = '出库单_' + rangeTxt + '_' + new Date().toISOString().split('T')[0]
      const out = await buildExport(csvRows, baseName, { format: event.format, sheetName: '出库单' })
      return { code: 0, data: Object.assign({ count: orders.length }, out) }
    }

    case 'exportSingleOrder': {
      // 导出单个订单送货单（订单详情/打印页用），支持 excel / csv
      const __p = await checkPermission('order:export'); if (__p.code !== 0) return __p
      const orderId = event.orderId || event.id
      if (!orderId) return { code: 5001, message: '缺少订单 ID 参数' }
      const res = await db.collection('orders').doc(orderId).get()
      const o = res.data
      if (!o) return { code: 5001, message: '订单不存在' }
      const d = new Date()
      const p2 = (n) => (n < 10 ? '0' + n : '' + n)
      const rows = [
        [(o.customerName || COMPANY_NAME) + '送货单'],
        [],
        ['订单号', o.orderNo],
        ['客户', o.customerName || ''],
        ['区域', o.customerRegion || ''],
        ['联系人', o.customerContact || ''],
        ['电话', o.customerPhone || ''],
        ['日期', d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())]
      ]
      if (o.ship_large || o.ship_medium || o.ship_small) {
        rows.push([])
        rows.push(['物流件型', '大件' + (o.ship_large || 0) + '/中件' + (o.ship_medium || 0) + '/小件' + (o.ship_small || 0)])
      }
      rows.push([])
      rows.push(['序号', '商品名称', '单价', '数量', '金额', '备注'])
      let idx = 1
      let grandTotal = 0
      ;(o.items || []).forEach(it => {
        const pq = Number(it.piece_qty || 0)
        const zq = Number(it.package_qty != null ? it.package_qty : it.zero_qty || 0)
        if (pq <= 0 && zq <= 0) return
        const amt = Number(it.amount != null ? it.amount : 0)
        grandTotal += amt
        rows.push([idx++, it.name || '', Number(it.price != null ? it.price : it.price_piece || 0).toFixed(2), it.qtyDesc || qtyDescLocal(it), amt.toFixed(2), it.remark || ''])
      })
      rows.push([])
      rows.push(['合计', '', '', '', grandTotal.toFixed(2), ''])
      const baseName = (o.customerName || '客户') + '_送货单_' + o.orderNo
      const out = await buildExport(rows, baseName, { format: event.format, sheetName: '送货单' })
      return { code: 0, data: out }
    }

    case 'printOrder': {
      // 生成送货单 PDF（纯 JS 排版，内嵌子集中文字体）
      const __p = await checkPermission('order:print'); if (__p.code !== 0) return __p
      const orderId = event.orderId || event.id
      if (!orderId) return { code: 5001, message: '缺少订单 ID 参数' }

      // 1) 拉取订单 + 客户 + 欠款（与 detail 相同逻辑）
      const res = await db.collection('orders').doc(orderId).get()
      const o = res.data
      if (!o) return { code: 5001, message: '订单不存在' }
      if (o.customerId) {
        try {
          const cRes = await db.collection('customers').doc(o.customerId).get()
          const c = cRes.data
          if (c) {
            o.customerPhone = c.phone || ''
            o.customerRegion = c.region || ''
            o.customerContact = c.contact || ''
            o.customerAddress = c.address || c.region || ''
          }
        } catch (e) {}
        try {
          const unpaid = await db.collection('orders')
            .where({ customerId: o.customerId, paymentStatus: db.command.in(['unpaid', 'pending']) })
            .get()
          o.totalDebt = unpaid.data.reduce((s, x) => s + Math.max(0, (x.totalAmount || 0) - (x.received_amount || x.receivedAmount || 0) - (x.total_discount || x.totalDiscount || 0)), 0)
        } catch (e) { o.totalDebt = 0 }
      }

      // 2) 收集所有文本用于字体子集化
      const allTextParts = [salesTitle(o), o.orderNo || '', o.customerName || '', o.customerPhone || '', o.customerRegion || '', o.customerContact || '', o.customerAddress || '']
      let totalQty = 0
      let grandTotal = 0
      const items = (o.items || []).map(it => {
        const pq = Number(it.piece_qty || 0)
        const zq = Number(it.package_qty != null ? it.package_qty : it.zero_qty || 0)
        if (pq <= 0 && zq <= 0) return null
        const amt = Number(it.amount != null ? it.amount : 0)
        totalQty += pq + zq
        grandTotal += amt
        return {
          name: it.name || '', spec: it.spec || '',
          qtyDesc: it.qtyDesc || qtyDescLocal(it),
          price: it.price != null ? it.price : (it.price_piece != null ? it.price_piece : ''),
          amount: amt.toFixed(2), remark: it.remark || ''
        }
      }).filter(Boolean)
      items.forEach(it => allTextParts.push(it.name, it.spec, String(it.qtyDesc), String(it.price), it.amount, it.remark))
      allTextParts.push(String(totalQty), grandTotal.toFixed(2), o.totalDebt != null ? String(o.totalDebt) : '0', '合计', '编号', '产品', '规格型号', '单位', '总数量', '单价', '金额', '备注', '累计欠款：', '订货电话：', '订货地址：', '主营业务：速冻面点，火锅丸子，单位团餐，酒店食材', '收货人(签字)：______________', '制单人：', '注：收到货后，请仔细查看储存说明，冷冻食品属特殊商品，如非产品本身质量问题、日期问题，一经售出，概不退换，谢谢合作！', '销售日期：', '单号：', '产品合计：', '送货金额：', '客户：', '（）', '件', '包', '¥.-0123456789，%！：')
      const d = new Date()
      const p2 = (n) => (n < 10 ? '0' + n : '' + n)
      allTextParts.push(d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()))

      // 3) 字体子集化 + 生成 PDF
      const fs = require('fs')
      const path = require('path')
      const { PDFDocument } = require('pdf-lib')
      const fontkit = require('@pdf-lib/fontkit')
      const subset = require('subset-font')
      const fullFont = fs.readFileSync(path.join(__dirname, 'fonts', 'NotoSansSC.ttf'))
      const subFont = await subset(fullFont, allTextParts.join(''))
      const doc = await PDFDocument.create()
      doc.registerFontkit(fontkit)
      const font = await doc.embedFont(subFont)

      const page = doc.addPage([595.28, 841.89]) // A4
      const M = 40 // 页边距
      const CW = 595.28 - M * 2 // 内容宽度
      let y = 800

      const drawText = (txt, opts) => {
        page.drawText(txt, { x: opts.x || M, y, size: opts.size || 11, font, color: opts.color, maxWidth: opts.maxW || CW, align: opts.align })
      }
      const lineGap = (h) => { y -= (h || 18) }

      // 标题（居中）
      const title = salesTitle(o)
      const titleX = (595.28 - font.widthOfTextAtSize(title, 18)) / 2
      page.drawText(title, { x: titleX, y, size: 18, font, color: require('pdf-lib').rgb(0.15, 0.15, 0.15) })
      y -= 30
      // 单号 + 日期
      const dateStr = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())
      drawText('单号：' + (o.orderNo || ''), { size: 11 })
      lineGap(18)
      drawText('销售日期：' + dateStr, { size: 11 })
      lineGap(20)
      // 客户
      drawText('客户：' + (o.customerName || '') + (o.customerPhone ? '（' + o.customerPhone + '）' : ''), { size: 12 })
      lineGap(22)

      // 表格
      const cols = [24, 80, 60, 28, 52, 44, 44, 60] // 各列宽
      const colLabels = ['编号', '产品', '规格型号', '单位', '总数量', '单价', '金额', '备注']
      const colTotal = cols.reduce((a, b) => a + b, 0)
      const colX = []
      let cx = M
      cols.forEach((w) => { colX.push(cx); cx += w })

      // 表头背景
      const tableTop = y + 12
      const tableH = 18
      page.drawRectangle({ x: M, y: tableTop - tableH, width: CW, height: tableH, color: require('pdf-lib').rgb(0.96, 0.96, 0.96), borderColor: require('pdf-lib').rgb(0.3, 0.3, 0.3), borderWidth: 0.5 })
      colLabels.forEach((label, i) => {
        page.drawText(label, { x: colX[i] + 4, y: y - 4, size: 10, font })
      })
      lineGap(tableH + 4)

      // 数据行
      items.forEach((it, idx) => {
        const rowTop = y + 4
        page.drawRectangle({ x: M, y: rowTop - 14, width: CW, height: 16, borderColor: require('pdf-lib').rgb(0.3, 0.3, 0.3), borderWidth: 0.5 })
        const cells = [String(idx + 1), it.name, it.spec, '件', it.qtyDesc, String(it.price), it.amount, it.remark]
        cells.forEach((c, i) => {
          const maxW = cols[i] - 6
          let txt = c
          if (font.widthOfTextAtSize(c, 10) > maxW) {
            while (txt.length > 1 && font.widthOfTextAtSize(txt + '…', 10) > maxW) txt = txt.slice(0, -1)
            txt += '…'
          }
          let align = ''
          if (i >= 4) align = 'right'
          page.drawText(txt, { x: align === 'right' ? colX[i] + cols[i] - 6 - font.widthOfTextAtSize(txt, 10) : colX[i] + 4, y: rowTop - 4, size: 10, font })
        })
        lineGap(16)
      })

      // 合计行
      const totalRowTop = y + 4
      page.drawRectangle({ x: M, y: totalRowTop - 14, width: CW, height: 16, color: require('pdf-lib').rgb(0.95, 0.95, 0.95), borderColor: require('pdf-lib').rgb(0.3, 0.3, 0.3), borderWidth: 0.5 })
      page.drawText('合计', { x: colX[1] + 4, y: totalRowTop - 4, size: 10, font })
      page.drawText(String(totalQty), { x: colX[4] + cols[4] - 6 - font.widthOfTextAtSize(String(totalQty), 10), y: totalRowTop - 4, size: 10, font })
      const amtStr = grandTotal.toFixed(2)
      page.drawText('¥' + amtStr, { x: colX[6] + cols[6] - 6 - font.widthOfTextAtSize('¥' + amtStr, 10), y: totalRowTop - 4, size: 10, font })
      lineGap(24)

      // 产品合计 / 送货金额
      drawText('产品合计：¥' + grandTotal.toFixed(2) + '    送货金额：¥' + grandTotal.toFixed(2), { size: 11 })
      lineGap(18)

      // 累计欠款
      const debt = o.totalDebt != null ? o.totalDebt : 0
      drawText('累计欠款：¥' + Number(debt).toFixed(2), { size: 11, color: require('pdf-lib').rgb(0.75, 0.1, 0.1) })
      lineGap(28)

      // 底部信息
      const { rgb } = require('pdf-lib')
      page.drawLine({ start: { x: M, y }, end: { x: 595.28 - M, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
      lineGap(16)
      drawText('订货电话：' + (o.customerPhone || ''), { size: 10 })
      lineGap(16)
      drawText('订货地址：' + (o.customerAddress || ''), { size: 10 })
      lineGap(16)
      drawText('主营业务：速冻面点，火锅丸子，单位团餐，酒店食材', { size: 10 })
      lineGap(20)
      drawText('收货人(签字)：______________', { size: 10 })
      lineGap(24)

      // 备注
      page.drawLine({ start: { x: M, y }, end: { x: 595.28 - M, y }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) })
      lineGap(14)
      drawText('注：收到货后，请仔细查看储存说明，冷冻食品属特殊商品，如非产品本身质量问题、日期问题，一经售出，概不退换，谢谢合作！', { size: 9 })

      const pdfBuf = Buffer.from(await doc.save())

      // 4) 上传云存储
      const safeName = ((o.customerName || '客户') + '_送货单_' + (o.orderNo || 'no')).replace(/\//g, '')
      const cloudPath = 'exports/' + safeName + '_' + Date.now() + '.pdf'
      const up = await cloud.uploadFile({ cloudPath, fileContent: pdfBuf })
      return { code: 0, data: { fileID: up.fileID, filename: safeName + '.pdf' } }
    }

    case 'autoConfirmTrigger': {
      // 定时触发器入口（每5分钟轮询）：到点且当天未跑过 → 批量确认当天未处理订单（幂等）
      const cfg = await getAutoConfirmCfg()
      const now = new Date()
      if (!cfg.enabled) {
        return { code: 0, data: { skipped: true, reason: 'disabled' } }
      }
      const [hh, mm] = String(cfg.time).split(':').map(Number)
      if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) {
        return { code: 0, data: { skipped: true, reason: 'not_yet' } }
      }
      const t0 = new Date(); t0.setHours(0, 0, 0, 0)
      const already = await todayAutoMark()
      if (already && already.type === 'auto_confirm') {
        return { code: 0, data: { skipped: true, reason: 'already_ran' } }
      }
      await ensureLogCollection()
      const res = await runAutoConfirm()
      await markAutoRan('auto_confirm', { time: cfg.time, sort: res.sortN, out: res.outN })
      return { code: 0, data: { ran: true, sort: res.sortN, out: res.outN } }
    }
    case 'getAutoConfirmPolicy': {
      // 工作台超时高亮策略：返回当前是否到点、今天是否已自动确认
      const cfg = await getAutoConfirmCfg()
      const now = new Date()
      const [hh, mm] = String(cfg.time).split(':').map(Number)
      const duePassed = cfg.enabled && (now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm)
      const mark = await todayAutoMark()
      const alreadyRan = !!(mark && mark.type === 'auto_confirm')
      return { code: 0, data: { enabled: cfg.enabled, time: cfg.time, duePassed: duePassed, alreadyRan: alreadyRan } }
    }
    case 'qaClearAutoConfirmLog': {
      // 仅 QA 环境（QA_IMPERSONATE=1）可用：用服务端身份清空 auto_confirm_log（小程序端按创建者权限删不到云函数写的记录）
      if (typeof process === 'undefined' || !process.env || process.env.QA_IMPERSONATE !== '1') return { code: 403, message: 'qa action disabled' }
      await ensureLogCollection()
      let n = 0
      for (;;) {
        const rs = await db.collection('auto_confirm_log').limit(100).get()
        if (!rs.data.length) break
        for (const it of rs.data) { await db.collection('auto_confirm_log').doc(it._id).remove(); n++ }
      }
      return { code: 0, data: { deleted: n } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
