const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'dashboard': {
      const { viewTab, timeTab, searchKey } = event
      let query = db.collection('orders').where({ paymentStatus: db.command.neq('paid') })
      if (searchKey) {
        query = query.where({ customerName: db.RegExp({ regexp: searchKey, options: 'i' }) })
      }
      const res = await query.get()
      let totalReceivable = 0, totalReceived = 0, totalUnpaid = 0
      res.data.forEach(o => {
        totalReceivable += o.totalAmount || 0
        totalReceived += o.receivedAmount || 0
        totalUnpaid += (o.totalAmount || 0) - (o.receivedAmount || 0)
      })
      return { code: 0, data: { totalReceivable, totalReceived, totalUnpaid, customers: res.data } }
    }
    case 'collect': {
      const { orderId, amount, method } = event
      const order = await db.collection('orders').doc(orderId).get()
      const newReceived = (order.data.receivedAmount || 0) + amount
      const paymentStatus = newReceived >= order.data.totalAmount ? 'paid' : 'pending'
      await db.collection('orders').doc(orderId).update({ data: { receivedAmount: newReceived, paymentStatus } })
      await db.collection('payments').add({ data: { orderId, amount, method, created_at: db.serverDate() } })
      return { code: 0, data: {} }
    }
    case 'confirm': {
      await db.collection('orders').doc(event.orderId).update({ data: { paymentStatus: 'paid' } })
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
