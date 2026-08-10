const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'login': {
      const { role } = event
      let user = await db.collection('users').where({ openid }).get()
      if (user.data.length === 0) {
        const users = await db.collection('users').get()
        const hasAdmin = users.data.some(u => u.role === 'admin')
        const finalRole = (!hasAdmin && role === 'admin') ? 'admin' : role
        const newUser = {
          openid,
          name: '用户' + openid.slice(-4),
          role: finalRole,
          phone: '',
          createdAt: db.serverDate()
        }
        await db.collection('users').add({ data: newUser })
        user = { data: [newUser] }
      }
      return { code: 0, data: { userInfo: user.data[0] } }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
