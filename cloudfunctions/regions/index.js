const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  // T57-RC-3：身份校验（原实现匿名可查）。list 返回的是公开字典数据（区域/排序），
  // 无敏感信息，但统一登录门禁防止匿名探测接口存在性
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: 401, message: '无法获取用户身份，请在小程序内访问' }
  switch (action) {
    case 'list': {
      try {
        const res = await db.collection('regions').orderBy('sort', 'asc').get()
        return { code: 0, data: res.data }
      } catch (e) {
        // 集合未初始化等场景降级为空列表（前端 regionOptions 有兜底）
        return { code: 0, data: [] }
      }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
