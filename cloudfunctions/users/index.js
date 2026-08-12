const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // 权限校验：只有管理员可以访问
  async function checkAdmin(userOpenid) {
    const userResult = await db.collection('users').where({ openid: userOpenid }).get()
    if (userResult.data.length === 0) {
      return { code: 401, message: '用户不存在' }
    }
    const user = userResult.data[0]
    if (user.role !== 'admin') {
      return { code: 403, message: '只有管理员可以访问' }
    }
    return { code: 0, user }
  }

  const authResult = await checkAdmin(openid)
  if (authResult.code !== 0) {
    return authResult
  }

  switch (action) {
    case 'list': {
      // 获取所有用户，按创建时间倒序
      const res = await db.collection('users')
        .orderBy('createdAt', 'desc')
        .get()
      return { code: 0, data: res.data }
    }

    case 'add': {
      // 创建新用户（管理员创建）
      const { name, phone, region, role } = event
      const newUser = {
        name,
        phone: phone || '',
        region: region || '',
        role: role || 'orderer',
        status: 'active',
        permissions: [], // 根据角色自动分配
        createdBy: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      // 根据角色自动分配权限
      const rolePermissions = {
        admin: [
          'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
          'product:view', 'product:edit',
          'customer:view', 'customer:edit',
          'sort:task',
          'warehouse:confirm',
          'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount',
          'report:view', 'report:export', 'report:ledger',
          'member:manage', 'permission:manage'
        ],
        orderer: [
          'order:create', 'order:edit',
          'product:view',
          'customer:view',
          'report:view'
        ],
        sorter: [
          'sort:task'
        ],
        warehouse: [
          'warehouse:confirm',
          'product:view'
        ]
      }
      newUser.permissions = rolePermissions[role] || []

      const res = await db.collection('users').add({ data: newUser })
      return { code: 0, data: { _id: res._id } }
    }

    case 'remove': {
      // 移除用户（不能移除自己）
      if (event.userId === openid) {
        return { code: 400, message: '无法移除自己' }
      }

      const userResult = await db.collection('users').doc(event.userId).get()
      if (userResult.data.role === 'admin') {
        return { code: 400, message: '无法移除管理员' }
      }

      await db.collection('users').doc(event.userId).remove()
      return { code: 0, data: {} }
    }

    case 'update-role': {
      // 更新用户角色
      if (event.userId === openid) {
        return { code: 400, message: '无法修改自己的角色' }
      }

      const userResult = await db.collection('users').doc(event.userId).get()
      if (userResult.data.role === 'admin' && event.role !== 'admin') {
        return { code: 400, message: '无法移除管理员权限' }
      }

      // 根据新角色自动分配权限
      const rolePermissions = {
        admin: [
          'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
          'product:view', 'product:edit',
          'customer:view', 'customer:edit',
          'sort:task',
          'warehouse:confirm',
          'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount',
          'report:view', 'report:export', 'report:ledger',
          'member:manage', 'permission:manage'
        ],
        orderer: [
          'order:create', 'order:edit',
          'product:view',
          'customer:view',
          'report:view'
        ],
        sorter: [
          'sort:task'
        ],
        warehouse: [
          'warehouse:confirm',
          'product:view'
        ]
      }

      await db.collection('users').doc(event.userId).update({
        data: {
          role: event.role,
          permissions: rolePermissions[event.role] || [],
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: {} }
    }

    case 'update-status': {
      // 禁用/启用用户
      if (event.userId === openid) {
        return { code: 400, message: '无法禁用自己' }
      }

      await db.collection('users').doc(event.userId).update({
        data: {
          status: event.status,
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: {} }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
