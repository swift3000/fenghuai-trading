const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'summary': {
      const { reportTab, timeTab } = event
      let query = db.collection('orders')
      if (timeTab === 'day') {
        const today = new Date(); today.setHours(0,0,0,0)
        query = query.where({ created_at: db.command.gte(today) })
      }
      const res = await query.get()
      let data = []
      if (reportTab === 'product') {
        const productMap = {}
        res.data.forEach(o => {
          (o.items || []).forEach(item => {
            if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, amount: 0 }
            productMap[item.name].qty += item.qty || 0
            productMap[item.name].amount += item.amount || 0
          })
        })
        data = Object.values(productMap)
      } else if (reportTab === 'customer') {
        const customerMap = {}
        res.data.forEach(o => {
          if (!customerMap[o.customerName]) customerMap[o.customerName] = { name: o.customerName, count: 0, amount: 0 }
          customerMap[o.customerName].count++
          customerMap[o.customerName].amount += o.totalAmount || 0
        })
        data = Object.values(customerMap)
      }
      return { code: 0, data }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
