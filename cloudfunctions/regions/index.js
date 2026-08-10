const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'list': {
      const res = await db.collection('regions').orderBy('sort', 'asc').get()
      return { code: 0, data: res.data }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
