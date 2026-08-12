const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'summary': {
      const { reportTab, timeTab } = event
      const now = new Date()
      
      // 时间范围过滤
      let dateFilter = null
      if (timeTab === 'day') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
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
      
      if (reportTab === 'product') {
        // 商品汇总统计
        let query = db.collection('orders')
        if (dateFilter) {
          query = query.where(dateFilter)
        }
        
        const ordersResult = await query.get()
        const orders = ordersResult.data
        
        // 按商品聚合统计
        const productMap = {}
        orders.forEach(order => {
          const items = order.items || []
          items.forEach(item => {
            const key = item._id || item.name
            if (!productMap[key]) {
              productMap[key] = {
                _id: key,
                name: item.name,
                spec: item.spec || '',
                totalQty: 0,
                totalAmount: 0,
                orderCount: 0
              }
            }
            productMap[key].totalQty += item.qty || 0
            productMap[key].totalAmount += (item.price || 0) * (item.qty || 0)
            productMap[key].orderCount += 1
          })
        })
        
        let products = Object.values(productMap)
        // 按销售额降序排序
        products.sort((a, b) => b.totalAmount - a.totalAmount)
        
        // 计算总计
        const totalAmount = products.reduce((sum, p) => sum + p.totalAmount, 0)
        const totalQty = products.reduce((sum, p) => sum + p.totalQty, 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            totalQty,
            productCount: products.length,
            products
          }
        }
      } else if (reportTab === 'customer') {
        // 客户汇总统计
        let query = db.collection('orders')
        if (dateFilter) {
          query = query.where(dateFilter)
        }
        
        const ordersResult = await query.get()
        const orders = ordersResult.data
        
        // 按客户聚合统计
        const customerMap = {}
        orders.forEach(order => {
          const customerId = order.customerId
          if (!customerMap[customerId]) {
            customerMap[customerId] = {
              _id: customerId,
              name: order.customerName,
              region: order.customerRegion || '',
              totalAmount: 0,
              paidAmount: 0,
              unpaidAmount: 0,
              orderCount: 0,
              itemCount: 0
            }
          }
          const customer = customerMap[customerId]
          customer.totalAmount += order.totalAmount || 0
          customer.paidAmount += order.paidAmount || 0
          customer.unpaidAmount += (order.totalAmount || 0) - (order.paidAmount || 0)
          customer.orderCount += 1
          customer.itemCount += (order.items || []).length
        })
        
        let customers = Object.values(customerMap)
        // 按采购金额降序排序
        customers.sort((a, b) => b.totalAmount - a.totalAmount)
        
        // 计算总计
        const totalAmount = customers.reduce((sum, c) => sum + c.totalAmount, 0)
        const totalOrders = customers.reduce((sum, c) => sum + c.orderCount, 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            totalOrders,
            customerCount: customers.length,
            customers
          }
        }
      } else if (reportTab === 'payment') {
        // 收款台账统计
        let query = db.collection('payments')
        if (dateFilter) {
          query = query.where(dateFilter)
        }
        
        const paymentsResult = await query.orderBy('created_at', 'desc').get()
        const payments = paymentsResult.data
        
        // 按收款方式统计
        const methodMap = {}
        payments.forEach(payment => {
          const method = payment.paymentMethod || '其他'
          if (!methodMap[method]) {
            methodMap[method] = {
              method,
              count: 0,
              amount: 0
            }
          }
          methodMap[method].count += 1
          methodMap[method].amount += payment.amount || 0
        })
        
        const methods = Object.values(methodMap)
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            paymentCount: payments.length,
            methods
          }
        }
      }
      
      return { code: 5001, message: '不支持的报表类型' }
    }
    
    case 'trend': {
      // 销售趋势分析
      const { days = 7 } = event
      const now = new Date()
      
      const trendData = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
        
        const ordersResult = await db.collection('orders').where({
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }).get()
        
        const orders = ordersResult.data
        const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        const orderCount = orders.length
        
        trendData.push({
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          amount: totalAmount,
          count: orderCount
        })
      }
      
      return {
        code: 0,
        data: {
          trendData,
          days
        }
      }
    }
    
    case 'export': {
      // 导出报表数据
      const { reportTab, timeTab, format = 'csv' } = event
      
      // 获取统计数据
      const summaryResult = await exports.main({
        action: 'summary',
        reportTab,
        timeTab
      }, context)
      
      const data = summaryResult.data || {}
      
      // 生成 CSV 内容
      let csvContent = ''
      
      if (reportTab === 'product') {
        csvContent = '商品名称，规格，数量，金额，订单数\n'
        data.products?.forEach(p => {
          csvContent += `"${p.name}","${p.spec || ''}",${p.totalQty},${p.totalAmount.toFixed(2)},${p.orderCount}\n`
        })
      } else if (reportTab === 'customer') {
        csvContent = '客户名称，区域，订单数，商品数，采购金额，已收款，欠款\n'
        data.customers?.forEach(c => {
          csvContent += `"${c.name}","${c.region || ''}",${c.orderCount},${c.itemCount},${c.totalAmount.toFixed(2)},${c.paidAmount.toFixed(2)},${c.unpaidAmount.toFixed(2)}\n`
        })
      } else if (reportTab === 'payment') {
        csvContent = '收款方式，笔数，金额\n'
        data.methods?.forEach(m => {
          csvContent += `"${m.method}",${m.count},${m.amount.toFixed(2)}\n`
        })
      }
      
      return {
        code: 0,
        data: {
          csvContent,
          filename: `报表_${reportTab}_${timeTab}_${Date.now()}.csv`
        }
      }
    }
    
    default:
      return { code: 1001, message: '未知 action' }
  }
}
