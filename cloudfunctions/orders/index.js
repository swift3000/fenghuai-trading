const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'create': {
      const { customerId, customerName, items, totalAmount } = event
      if (totalAmount <= 0) return { code: 2001, message: '订单金额不能为0' }
      const today = new Date()
      const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0')
      const count = await db.collection('orders').where({ orderNo: db.RegExp({ regexp: `丰淮商贸-${dateStr}`, options: 'i' }) }).count()
      const orderNo = `丰淮商贸-${dateStr}-${(count.total + 1).toString().padStart(4, '0')}`
      const order = {
        orderNo, customerId, customerName, items,
        totalAmount, status: 'submitted', paymentStatus: 'unpaid',
        created_at: db.serverDate()
      }
      const res = await db.collection('orders').add({ data: order })
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
      if (timeTab === 'today') {
        const today = new Date(); today.setHours(0,0,0,0)
        query = query.where({ created_at: db.command.gte(today) })
      }
      const res = await query.orderBy('created_at', 'desc').limit(50).get()
      return { code: 0, data: res.data }
    }
    case 'detail': {
      const res = await db.collection('orders').doc(event.orderId).get()
      return { code: 0, data: res.data }
    }
    case 'update-status': {
      await db.collection('orders').doc(event.orderId).update({ data: { status: event.status } })
      return { code: 0, data: {} }
    }
    case 'delete': {
      await db.collection('orders').doc(event.orderId).remove()
      return { code: 0, data: {} }
    }
    case 'todayStats': {
      const today = new Date(); today.setHours(0,0,0,0)
      const res = await db.collection('orders').where({ created_at: db.command.gte(today) }).get()
      let amount = 0
      res.data.forEach(o => { amount += o.totalAmount || 0 })
      return { code: 0, data: { count: res.data.length, amount } }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
