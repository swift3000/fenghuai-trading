const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== 北京时间边界工具（CLI 部署不注入运行时 TZ，统一在此按北京时间显式计算）=====
const BJ_OFFSET_MS = 8 * 3600 * 1000
function bjNow(){ const d=new Date(Date.now() + BJ_OFFSET_MS); return { getFullYear:()=>d.getUTCFullYear(), getMonth:()=>d.getUTCMonth(), getDate:()=>d.getUTCDate(), getDay:()=>d.getUTCDay(), getHours:()=>d.getUTCHours(), getMinutes:()=>d.getUTCMinutes(), getSeconds:()=>d.getUTCSeconds(), getTime:()=>d.getTime() } }
function bjDate(y, mo, d, h, mi, s, ms){ return new Date(Date.UTC(y, mo, d, h||0, mi||0, s||0, ms||0) - BJ_OFFSET_MS) }
function bjTodayStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate()) }
function bjTodayEnd(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999) }
function bjTomorrowStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate()+1) }
function bjWeekStart(){ const n=bjNow(); const day=n.getDay()||7; return bjDate(n.getFullYear(), n.getMonth(), n.getDate()-day+1) }
function bjWeekEnd(){ const n=bjNow(); const day=n.getDay()||7; return bjDate(n.getFullYear(), n.getMonth(), n.getDate()-day+6, 23, 59, 59, 999) }
function bjMonthStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), 1) }
function bjMonthEnd(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth()+1, 0, 23, 59, 59, 999) }
function bjFromStr(s, endDay){ const p=String(s).split("-").map(Number); return bjDate(p[0], p[1]-1, p[2], endDay?23:0, endDay?59:0, endDay?59:0, endDay?999:0) }
function bjDayAgo(i){ const n=bjNow(); const dt=new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()-i)); const y=dt.getUTCFullYear(), m=dt.getUTCMonth(), d=dt.getUTCDate(); return { start:bjDate(y,m,d), end:bjDate(y,m,d,23,59,59,999), label:(m+1)+"/"+d } }
// ===== 北京时间边界工具结束 =====


// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null


// 转义搜索词中的正则特殊字符
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 金额统一按「分」取整，规避浮点误差（0.1+0.2 之类）导致的状态/校验偏差
function toCents(n) {
  return Math.round((Number(n) || 0) * 100)
}
// 剩余欠款（分）= 订单金额 − 累计实收 − 累计折价
function remainingCents(total, received, discount) {
  return Math.max(0, toCents(total) - toCents(received) - toCents(discount))
}
// 账龄（天）：订单创建时间到现在的整天数（对齐原型 debtAgeDays）
function debtAgeDays(order) {
  const t = new Date(order.created_at).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}


// 权限校验
async function checkPermission(permission) {
  const { OPENID: __rawOID } = cloud.getWXContext()
  const OPENID = __impersonatedOpenid || __rawOID
  if (!OPENID) { return { code: 401, message: '无法获取用户身份，请在小程序内访问' } }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
  if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }

  if (user.role === 'admin') return { code: 0 }
  if (user.permissions && user.permissions.includes(permission)) return { code: 0 }
  return { code: 403, message: '无权限访问' }
}

// 追加订单操作记录
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

async function appendOrderLog(orderId, action, desc) {
  if (!orderId) return
  try {
    const identity = await getUserIdentity()
    await db.collection('orders').doc(orderId).update({
      data: {
        logs: db.command.push([{ action, desc, operatorName: identity.name, role: identity.role, time: Date.now() }])
      }
    })
  } catch (e) {
    console.error('记录订单操作日志失败', e)
  }
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const { action } = event
  switch (action) {
    case 'dashboard': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      const { viewTab, timeTab, searchKey } = event
      const now = new Date()
      
      // 时间范围过滤
      let dateFilter = null
      if (timeTab === 'today') {
        const start = bjTodayStart()
        const end = bjTodayEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'week') {
        // 周一为一周起点（getDay() 周日=0，需转为 7，否则周日查"本周"返回空集）
        const start = bjWeekStart()
        const end = bjWeekEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'month') {
        const start = bjMonthStart()
        const end = bjMonthEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'custom' && event.startDate && event.endDate) {
        // 自定义日期范围
        const start = bjFromStr(event.startDate)
        const end = bjFromStr(event.endDate, true)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      }

      // 合并视图/时间/搜索为单次 where：Query.where() 会整体替换旧条件而非合并
      const conds = []
      if (viewTab === 'unpaid') {
        // 未结清：有欠款（待确认或部分结清）
        conds.push({ paymentStatus: db.command.in(['unpaid', 'pending']) })
      } else if (viewTab === 'settled') {
        // 已结清：已全额付款
        conds.push({ paymentStatus: 'paid' })
      }
      // ledger（客户台账）：显示所有客户，不过滤订单状态
      
      // 应用时间过滤
      if (dateFilter) {
        conds.push({ ...dateFilter })
      }
      
      // 应用搜索过滤
      if (searchKey) {
        conds.push({ customerName: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) })
      }
      
      let query = db.collection('orders')
      if (conds.length === 1) query = query.where(conds[0])
      else if (conds.length > 1) query = query.where(db.command.and(conds))
      
      const ordersResult = await query.get()
      const orders = ordersResult.data
      
      // 按客户维度聚合统计（已收口径 = received_amount，含折价）
      const customerMap = {}
      orders.forEach(order => {
        const customerId = order.customerId
        if (!customerId) return  // 脏数据防护：无 customerId 的孤儿订单不参与客户聚合
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            _id: customerId,
            name: order.customerName,
            region: order.customerRegion || '',
            contact: order.customerContact || '',
            phone: order.customerPhone || '',
            totalAmount: 0,
            receivedAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            orderCount: 0,
            maxAge: 0,
            orders: []
          }
        }
        
        const customer = customerMap[customerId]
        const total = order.totalAmount || 0
        const received = order.received_amount || order.receivedAmount || 0
        const discount1 = order.total_discount || order.totalDiscount || 0
        // 以「分」为单位整数累加，避免浮点误差（0.1+0.2 类问题）
        customer.totalCents = (customer.totalCents || 0) + toCents(total)
        customer.receivedCents = (customer.receivedCents || 0) + toCents(received)
        customer.unpaidCents = (customer.unpaidCents || 0) + remainingCents(total, received, discount1)
        customer.orderCount += 1
        // 最长欠款账龄：仅统计未结清订单（剩余欠款>0），对齐原型 maxAge
        const unpaidNow = remainingCents(total, received, discount1)
        if (unpaidNow > 0) customer.maxAge = Math.max(customer.maxAge, debtAgeDays(order))
        customer.orders.push({
          _id: order._id,
          orderNo: order.orderNo,
          totalAmount: total,
          receivedAmount: received,
          paidAmount: received,
          unpaidAmount: Math.max(0, total - received - (order.total_discount || order.totalDiscount || 0)),
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.created_at,
          debtAgeDays: debtAgeDays(order)
        })
      })
      
      // 聚合值由「分」还原为元（四舍五入到分的数字，保持 number 供前端 toFixed/排序/求和）
      let customers = Object.values(customerMap).map(c => ({
        ...c,
        totalAmount: Math.round(c.totalCents) / 100,
        receivedAmount: Math.round(c.receivedCents) / 100,
        paidAmount: Math.round(c.receivedCents) / 100,
        unpaidAmount: Math.round(c.unpaidCents) / 100
      }))
      
      // 根据视图标签过滤客户
      if (viewTab === 'unpaid') {
        // 只显示有欠款的客户
        customers = customers.filter(c => c.unpaidAmount > 0)
      } else if (viewTab === 'settled') {
        // 只显示已结清的客户（当前无欠款）
        customers = customers.filter(c => c.unpaidAmount === 0 && c.totalAmount > 0)
      }
      
      // 按欠款金额降序排序
      customers.sort((a, b) => b.unpaidAmount - a.unpaidAmount)
      
      // 计算总计
      const totalReceivable = customers.reduce((sum, c) => sum + c.totalAmount, 0)
      const totalReceived = customers.reduce((sum, c) => sum + c.paidAmount, 0)
      const totalUnpaid = customers.reduce((sum, c) => sum + c.unpaidAmount, 0)
      
      return {
        code: 0,
        data: {
          totalReceivable,
          totalReceived,
          totalUnpaid,
          customerCount: customers.length,
          settledCount: customers.filter(c => c.unpaidAmount === 0).length,
          customers
        }
      }
    }
    
    case 'customerDetail': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      // 获取单个客户的详细信息
      const { customerId } = event
      if (!customerId) {
        return { code: 4001, message: 'customerId 参数缺失' }
      }
      
      const ordersResult = await db.collection('orders')
        .where({ customerId })
        .orderBy('created_at', 'desc')
        .get()
      
      const orders = ordersResult.data
      const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
      const paidAmount = orders.reduce((sum, o) => sum + (o.received_amount || o.receivedAmount || 0), 0)
      const discountAmount = orders.reduce((sum, o) => sum + (o.total_discount || o.totalDiscount || 0), 0)
      
      return {
        code: 0,
        data: {
          orders,
          totalAmount,
          paidAmount,
          unpaidAmount: Math.max(0, totalAmount - paidAmount - discountAmount)
        }
      }
    }
    
    case 'collect': {
      const __p = await checkPermission('receivable:collect'); if (__p.code !== 0) return __p
      // 登记收款（两步流程第一步；下单员/分拣员/管理员可，库管不可）
      const { orderId, amount, paymentMethod, note, discount, clientToken } = event

      // 折价/减免属独立权限：即使持有 receivable:collect，若未配置 receivable:discount 也不得折价（纵深防御，前端已用 canDiscount 隐藏入口）
      if (discount && discount > 0) {
        const __d = await checkPermission('receivable:discount')
        if (__d.code !== 0) return { code: 403, message: '无折价/减免权限' }
      }
      
      if (!orderId || !amount || amount <= 0) {
        return { code: 4001, message: '订单 ID 和收款金额为必填' }
      }
      
      const orderRes = await db.collection('orders').doc(orderId).get()
      const order = orderRes.data
      
      if (!order) {
        return { code: 4004, message: '订单不存在' }
      }
      
      // 幂等键（T11 P2-3）：前端每次打开登记弹窗生成一个 clientToken；
      // 网络重试/双击带同一 token 进来 → 复用首次登记的 pending 记录，不重复生成
      const token = clientToken || `auto_${orderId}_${Date.now()}`
      const dupRes = await db.collection('payments')
        .where({ order_id: orderId, client_token: token })
        .limit(1)
        .get()
      if (dupRes.data.length > 0) {
        const first = dupRes.data[0]
        console.log('[collect] 幂等命中，复用已有 pending 记录', first._id)
        return { code: 0, data: { paymentId: first._id, reused: true } }
      }
      
      // 剩余欠款 = 订单金额 − 累计实收 − 累计折价/货损
      const received = order.received_amount || order.receivedAmount || 0
      const totalDiscount = order.total_discount || order.totalDiscount || 0
      // 已登记未确认的 pending 收款也占额：否则多笔待确认收款可累计超出剩余欠款
      // 用两个单字段等值查询分别取 orderId / order_id 再按 _id 去重，避免 or 链式 where 覆盖导致跨订单误统计
      let pendingCents = 0
      try {
        const q1 = await db.collection('payments').where({ orderId: orderId, status: 'pending' }).limit(100).get()
        const q2 = await db.collection('payments').where({ order_id: orderId, status: 'pending' }).limit(100).get()
        const seen = {}
        for (const p of [].concat(q1.data || [], q2.data || [])) {
          if (seen[p._id]) continue
          seen[p._id] = true
          pendingCents += toCents(p.amount)
        }
      } catch (e) { console.error('统计待确认收款失败', e) }
      const remainingC = Math.max(0, remainingCents(order.totalAmount || 0, received, totalDiscount) - pendingCents)
      if (toCents(amount) > remainingC) {
        return { code: 4002, message: `收款金额不能超过剩余欠款 ¥${(remainingC / 100).toFixed(2)}` }
      }
      
      // 登记收款：写入 payments（status=pending，待库管确认）；订单 unpaid→pending；实收在确认时才累加
      // 折价/货损：登记时即累加到订单 total_discount（前端登记时校验 金额+折价<=剩余欠款）
      if (discount && discount > 0) {
        try {
          const newDiscount = (order.total_discount || order.totalDiscount || 0) + discount
          await db.collection('orders').doc(orderId).update({
            data: {
              total_discount: newDiscount,
              totalDiscount: newDiscount,
              payment_status: 'pending',
              paymentStatus: 'pending'
            }
          })
        } catch (e) { console.error('累加折价失败', e) }
      }
      const payRes = await db.collection('payments').add({
        data: {
          order_id: orderId,
          orderId,
          customer_id: order.customerId,
          customerId: order.customerId,
          customer_name: order.customerName,
          customerName: order.customerName,
          amount,
          discount: discount || 0,
          method: paymentMethod || 'cash',
          note: note || '',
          status: 'pending',
          client_token: token,
          registered_by: cloud.getWXContext().OPENID,
          registered_at: db.serverDate(),
          created_at: db.serverDate()
        }
      })
      
      // 订单状态：未收款 → 待确认（不改变实收金额，确认时再累加）
      // last_pending_payment_id（T11 P1-fix）：持久化最近一笔 pending，重试/排查可直接定位
      await db.collection('orders').doc(orderId).update({
        data: {
          payment_status: 'pending',
          paymentStatus: 'pending',
          last_pending_payment_id: payRes._id
        }
      })
      await appendOrderLog(orderId, 'collect', `登记收款 ¥${Number(amount).toFixed(2)}（待确认）`)
      
      return { code: 0, data: { paymentId: payRes._id } }
    }
    
    case 'confirmPayment': {
      const __p = await checkPermission('receivable:confirm'); if (__p.code !== 0) return __p
      // 确认收款（两步流程第二步；库管/管理员可）
      const { paymentId, orderId, note } = event
      
      let payRes
      if (paymentId) {
        payRes = await db.collection('payments').doc(paymentId).get()
      } else if (orderId) {
        // 兼容：按订单取最近一条待确认记录
        const list = await db.collection('payments')
          .where({ orderId, status: 'pending' })
          .orderBy('created_at', 'asc')
          .limit(1)
          .get()
        payRes = list.data.length > 0 ? { data: list.data[0] } : null
      }
      
      const pay = payRes && payRes.data
      if (!pay) {
        return { code: 4004, message: '待确认的收款记录不存在' }
      }
      
      const targetOrderId = pay.orderId || pay.order_id
      if (!targetOrderId) {
        return { code: 4001, message: '收款记录缺少订单 ID' }
      }
      
      // 幂等守卫（T11 P2-3）：已确认的收款重复确认 → 直接返回成功，不重复写日志/覆盖确认人
      if (pay.status === 'confirmed') {
        console.log('[confirmPayment] 幂等命中，该笔已确认', pay._id)
        return { code: 0, data: { reused: true } }
      }
      
      // 标记该笔收款为已确认
      await db.collection('payments').doc(pay._id).update({
        data: {
          status: 'confirmed',
          confirmed_by: cloud.getWXContext().OPENID,
          confirmed_at: db.serverDate(),
          confirm_note: note || ''
        }
      })
      
      // 重算订单：received_amount = Σ已确认实收；payment_status = 结清则 paid，否则 pending
      const orderRes = await db.collection('orders').doc(targetOrderId).get()
      const order = orderRes.data
      if (order) {
        const confirmedList = await db.collection('payments')
          .where({ orderId: targetOrderId, status: 'confirmed' })
          .get()
        const confirmedAmount = confirmedList.data.reduce((sum, p) => sum + (p.amount || 0), 0)
        const totalDiscount = order.total_discount || order.totalDiscount || 0
        const total = order.totalAmount || 0
        const newStatus = remainingCents(total, confirmedAmount, totalDiscount) <= 0 ? 'paid' : 'pending'
        await db.collection('orders').doc(targetOrderId).update({
          data: {
            received_amount: confirmedAmount,
            receivedAmount: confirmedAmount,
            payment_status: newStatus,
            paymentStatus: newStatus,
            paymentConfirmedAt: db.serverDate(),
            paymentConfirmedBy: cloud.getWXContext().OPENID,
            paymentConfirmNote: note || ''
          }
        })
        await appendOrderLog(targetOrderId, 'confirm', `确认收款 ¥${Number(pay.amount || 0).toFixed(2)}`)
      }
      
      return { code: 0, data: {} }
    }
    
    case 'paymentHistory': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      // 获取收款历史记录
      const { customerId, limit = 50 } = event
      
      let query = db.collection('payments').orderBy('created_at', 'desc').limit(limit)
      
      if (customerId) {
        query = query.where({ customerId })
      }
      
      const res = await query.get()
      
      return {
        code: 0,
        data: {
          payments: res.data,
          totalCount: res.data.length
        }
      }
    }
    
    
    case 'pendingConfirm': {
      const __p = await checkPermission('receivable:confirm'); if (__p.code !== 0) return __p
      // 获取待确认收款列表（库管/管理员可见）
      const res = await db.collection('payments')
        .where({ status: 'pending' })
        .orderBy('registered_at', 'asc')
        .limit(50)
        .get()
      
      // 补充订单号和登记人信息
      const payments = await Promise.all(res.data.map(async (pay) => {
        const orderRes = await db.collection('orders').doc(pay.orderId).get()
        const order = orderRes.data || {}
        
        // 获取登记人信息
        let registeredBy = '未知'
        if (pay.registered_by) {
          const userRes = await db.collection('users').where({ openid: pay.registered_by }).get()
          if (userRes.data.length > 0) {
            registeredBy = userRes.data[0].name || '未知'
          }
        }
        
        return {
          ...pay,
          orderNo: order.orderNo || '未知订单',
          registeredBy,
          registeredAt: pay.registered_at ? new Date(pay.registered_at).toLocaleString('zh-CN') : ''
        }
      }))
      
      return {
        code: 0,
        data: payments
      }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
