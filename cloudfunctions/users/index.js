const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'list': {
      const res = await db.collection('users').get()
      return { code: 0, data: res.data }
    }
    case 'add': {
      const res = await db.collection('users').add({ data: { ...event, created_at: db.serverDate() } })
      return { code: 0, data: { _id: res._id } }
    }
    case 'remove': {
      await db.collection('users').doc(event.userId).remove()
      return { code: 0, data: {} }
    }
    case 'update-role': {
      await db.collection('users').doc(event.userId).update({ data: { role: event.role } })
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
