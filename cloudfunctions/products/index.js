const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'list': {
      const { searchKey } = event
      let query = db.collection('products')
      if (searchKey) {
        query = query.where(db.command.or([
          { name: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { material_code: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      const res = await query.orderBy('created_at', 'desc').limit(100).get()
      return { code: 0, data: res.data }
    }
    case 'create': {
      const res = await db.collection('products').add({ data: { ...event, created_at: db.serverDate() } })
      return { code: 0, data: { _id: res._id } }
    }
    case 'update': {
      const { productId, ...data } = event
      await db.collection('products').doc(productId).update({ data })
      return { code: 0, data: {} }
    }
    case 'delete': {
      await db.collection('products').doc(event.productId).remove()
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
