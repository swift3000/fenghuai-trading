const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null


// 转义搜索词中的正则特殊字符
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function checkPermission(openid, permission) {
  // 如果是后台调用（OPENID 为空），跳过权限校验
  if (!openid) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0, user: { permissions: [permission], role: 'admin' } }
  }
  
  const userResult = await db.collection('users').where({ openid }).get()
  if (userResult.data.length === 0) {
    // 未注册用户不自动提权：管理员创建统一走 auth.login 的「零配置首管理员」逻辑
    return { code: 401, message: '用户不存在，请先登录' }
  }
  const user = userResult.data[0]
  if (user.role === 'admin') return { code: 0, user }
  if (!user.permissions || !user.permissions.includes(permission)) {
    return { code: 403, message: '无权限访问' }
  }
  return { code: 0, user }
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const { action } = event
  const openid = __impersonatedOpenid || cloud.getWXContext().OPENID

  switch (action) {
    case 'list': {
      const authResult = await checkPermission(openid, 'customer:view')
      if (authResult.code !== 0) return authResult
      const { searchKey } = event
      let query = db.collection('customers')
      if (searchKey) {
        query = query.where(db.command.or([
          { name: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { alias: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { phone: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { region: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) }
        ]))
      }
      const res = await query.orderBy('createdAt', 'desc').limit(100).get()
      
      return { code: 0, data: res.data }
    }
    case 'create': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      const { name, alias, region, phone, contact } = event
      if (!name || !String(name).trim()) return { code: 4001, message: '客户名称不能为空' }
      
      const newCustomer = {
        name,
        alias: alias !== undefined ? alias : '',
        region: region !== undefined ? region : '',
        phone: phone !== undefined ? phone : '',
        contact: contact !== undefined ? contact : '',
        createdBy: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      const res = await db.collection('customers').add({ data: newCustomer })
      
      return { code: 0, data: { _id: res._id } }
    }
    case 'update': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      const { customerId, name, alias, region, phone, contact } = event
      
      // 更新客户信息
      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (alias !== undefined) updateData.alias = alias
      if (region !== undefined) updateData.region = region
      if (phone !== undefined) updateData.phone = phone
      if (contact !== undefined) updateData.contact = contact
      updateData.updatedAt = db.serverDate()
      
      await db.collection('customers').doc(customerId).update({ 
        data: updateData
      })
      
      return { code: 0, data: {} }
    }
    case 'delete': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      // 删除客户
      await db.collection('customers').doc(event.customerId).remove()
      return { code: 0, data: {} }
    }
    case 'regions': {
      const authResult = await checkPermission(openid, 'customer:view')
      if (authResult.code !== 0) return authResult
      // 获取所有区域用于下拉选择
      const regionsResult = await db.collection('regions').get()
      return { code: 0, data: regionsResult.data }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
