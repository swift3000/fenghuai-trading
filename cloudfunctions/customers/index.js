const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'list': {
      const { searchKey } = event
      let query = db.collection('customers')
      if (searchKey) {
        query = query.where(db.command.or([
          { name: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { alias: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { contact: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { region: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      const res = await query.orderBy('created_at', 'desc').limit(100).get()
      return { code: 0, data: res.data }
    }
    case 'create': {
      const res = await db.collection('customers').add({ data: { ...event, created_at: db.serverDate() } })
      return { code: 0, data: { _id: res._id } }
    }
    case 'update': {
      const { customerId, ...data } = event
      await db.collection('customers').doc(customerId).update({ data })
      return { code: 0, data: {} }
    }
    case 'delete': {
      await db.collection('customers').doc(event.customerId).remove()
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
