const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'getConfig': {
      const res = await db.collection('system_config').doc('global').get()
      return { code: 0, data: res.data }
    }
    case 'updateConfig': {
      const { key, value } = event
      await db.collection('system_config').doc('global').update({ data: { [key]: value } })
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
