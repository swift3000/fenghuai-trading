const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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


// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0 }
  }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
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
  const { action } = event
  switch (action) {
    case 'dashboard': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      const { viewTab, timeTab, searchKey } = event
      const now = new Date()
      
      // 时间范围过滤
      let dateFilter = null
      if (timeTab === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'week') {
        const day = now.getDay()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 6, 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'custom' && event.startDate && event.endDate) {
        // 自定义日期范围
        const start = new Date(event.startDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(event.endDate)
        end.setHours(23, 59, 59, 999)
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
        customer.orders.push({
          _id: order._id,
          orderNo: order.orderNo,
          totalAmount: total,
          receivedAmount: received,
          paidAmount: received,
          unpaidAmount: Math.max(0, total - received - (order.total_discount || order.totalDiscount || 0)),
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.created_at
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
      const { orderId, amount, paymentMethod, note, discount } = event

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
          registered_by: cloud.getWXContext().OPENID,
          registered_at: db.serverDate(),
          created_at: db.serverDate()
        }
      })
      
      // 订单状态：未收款 → 待确认（不改变实收金额，确认时再累加）
      await db.collection('orders').doc(orderId).update({
        data: {
          payment_status: 'pending',
          paymentStatus: 'pending'
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
