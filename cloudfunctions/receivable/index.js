const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'dashboard': {
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
      }

      // 根据视图标签查询不同数据
      let query = db.collection('orders')
      
      if (viewTab === 'unpaid') {
        // 未结清：有欠款（totalAmount > paidAmount）
        query = query.where({
          paymentStatus: db.command.in(['unpaid', 'partial'])
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
      
      // 按客户维度聚合统计
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
            paidAmount: 0,
            unpaidAmount: 0,
            orderCount: 0,
            orders: []
          }
        }
        
        const customer = customerMap[customerId]
        customer.totalAmount += order.totalAmount || 0
        customer.paidAmount += order.paidAmount || 0
        customer.unpaidAmount += (order.totalAmount || 0) - (order.paidAmount || 0)
        customer.orderCount += 1
        customer.orders.push({
          _id: order._id,
          orderNo: order.orderNo,
          totalAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          unpaidAmount: (order.totalAmount || 0) - (order.paidAmount || 0),
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
      const paidAmount = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0)
      
      return {
        code: 0,
        data: {
          orders,
          totalAmount,
          paidAmount,
          unpaidAmount: totalAmount - paidAmount
        }
      }
    }
    
    case 'collect': {
      // 登记收款（库管操作）
      const { orderId, amount, paymentMethod, note } = event
      
      if (!orderId || !amount || amount <= 0) {
        return { code: 4001, message: '订单 ID 和收款金额为必填' }
      }
      
      // 获取订单信息
      const orderRes = await db.collection('orders').doc(orderId).get()
      const order = orderRes.data
      
      if (!order) {
        return { code: 4004, message: '订单不存在' }
      }
      
      // 验证收款金额
      const remainingAmount = (order.totalAmount || 0) - (order.paidAmount || 0)
      if (amount > remainingAmount) {
        return { code: 4002, message: `收款金额不能超过剩余欠款 ¥${remainingAmount.toFixed(2)}` }
      }
      
      // 更新订单收款信息
      const newPaidAmount = (order.paidAmount || 0) + amount
      let newPaymentStatus = order.paymentStatus || 'pending'
      
      if (newPaidAmount >= order.totalAmount) {
        newPaymentStatus = 'paid'
      } else if (newPaidAmount > 0) {
        newPaymentStatus = 'partial'
      }
      
      const updateData = {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        paymentRecord: db.command.push({
          amount,
          paymentMethod: paymentMethod || 'cash',
          note: note || '',
          paidAt: db.serverDate(),
          collectedBy: cloud.getWXContext().OPENID
        })
      }
      
      await db.collection('orders').doc(orderId).update({ data: updateData })
      
      // 记录收款流水
      await db.collection('payments').add({
        data: {
          orderId,
          customerId: order.customerId,
          customerName: order.customerName,
          amount,
          paymentMethod: paymentMethod || 'cash',
          note: note || '',
          collectedBy: cloud.getWXContext().OPENID,
          created_at: db.serverDate()
        }
      })
      
      return { code: 0, data: {} }
    }
    
    case 'confirmPayment': {
      // 确认收款（管理员确认）
      const { orderId, note } = event
      
      if (!orderId) {
        return { code: 4001, message: '订单 ID 为必填' }
      }
      
      const orderRes = await db.collection('orders').doc(orderId).get()
      const order = orderRes.data
      
      if (!order) {
        return { code: 4004, message: '订单不存在' }
      }
      
      // 确认收款，更新状态
      await db.collection('orders').doc(orderId).update({
        data: {
          paymentStatus: 'paid',
          paymentConfirmedAt: db.serverDate(),
          paymentConfirmedBy: cloud.getWXContext().OPENID,
          paymentConfirmNote: note || ''
        }
      })
      
      return { code: 0, data: {} }
    }
    
    case 'paymentHistory': {
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
    
    default:
      return { code: 1001, message: '未知 action' }
  }
}
