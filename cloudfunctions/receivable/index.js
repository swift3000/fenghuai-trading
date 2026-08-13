const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()


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

      // 根据视图标签查询不同数据
      let query = db.collection('orders')
      
      if (viewTab === 'unpaid') {
        // 未结清：有欠款（待确认或部分结清）
        query = query.where({
          paymentStatus: db.command.in(['unpaid', 'pending'])
        })
      } else if (viewTab === 'settled') {
        // 已结清：已全额付款
        query = query.where({
          paymentStatus: 'paid'
        })
      }
      // ledger（客户台账）：显示所有客户，不过滤订单状态
      
      // 应用时间过滤
      if (dateFilter) {
        query = query.where({
          ...dateFilter
        })
      }
      
      // 应用搜索过滤
      let ordersResult
      if (searchKey) {
        ordersResult = await query.where({
          customerName: db.RegExp({ regexp: searchKey, options: 'i' })
        }).get()
      } else {
        ordersResult = await query.get()
      }
      
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
        customer.totalAmount += total
        customer.receivedAmount += received
        customer.paidAmount += received
        const discount1 = order.total_discount || order.totalDiscount || 0
        customer.unpaidAmount += Math.max(0, total - received - discount1)
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
      
      let customers = Object.values(customerMap)
      
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
      const remainingAmount = Math.max(0, (order.totalAmount || 0) - received - totalDiscount)
      if (amount > remainingAmount) {
        return { code: 4002, message: `收款金额不能超过剩余欠款 ¥${remainingAmount.toFixed(2)}` }
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
        const newStatus = (total - confirmedAmount - totalDiscount) <= 0 ? 'paid' : 'pending'
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
