const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const pm = require('./perm-matrix-shared.js')

/**
 * 共享角色权限表（口径与 auth/DEFAULT_ROLE_PERMISSIONS 对齐）
 */
const ROLE_PERMISSIONS = {
  admin: [
    'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
    'product:view', 'product:edit',
    'customer:view', 'customer:edit',
    'sort:task',
    'warehouse:confirm',
    'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount',
    'report:view', 'report:export', 'report:ledger',
    'member:manage'
  ],
  orderer: [
    'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
    'product:view', 'product:edit',
    'customer:view', 'customer:edit',
    'sort:task',
    'warehouse:confirm',
    'receivable:view', 'receivable:collect', 'receivable:discount',
    'report:view', 'report:export', 'report:ledger'
  ],
  sorter: [
    'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
    'product:view', 'product:edit',
    'customer:view', 'customer:edit',
    'sort:task',
    'warehouse:confirm',
    'receivable:view', 'receivable:collect', 'receivable:discount',
    'report:view', 'report:export', 'report:ledger'
  ],
  warehouse: [
    'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
    'product:view', 'product:edit',
    'customer:view', 'customer:edit',
    'sort:task',
    'warehouse:confirm',
    'receivable:view', 'receivable:confirm', 'receivable:discount',
    'report:view', 'report:export', 'report:ledger'
  ]
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // 防御: 无微信上下文时直接拒绝, 避免 where({openid:undefined}) 抛异常
  if (!openid) {
    return { code: 401, message: '无法获取用户身份，请在小程序内访问' }
  }

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

      // 根据角色自动分配权限（口径与 auth/DEFAULT_ROLE_PERMISSIONS 对齐）
      newUser.permissions = ROLE_PERMISSIONS[role] || []

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

      // 根据新角色自动分配权限（口径与 auth/DEFAULT_ROLE_PERMISSIONS 对齐）
      await db.collection('users').doc(event.userId).update({
        data: {
          role: event.role,
          permissions: ROLE_PERMISSIONS[event.role] || [],
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


    // 读取各角色实际权限（默认+覆盖）
    case 'perm-config': {
      const configs = await db.collection('perm_configs').get()
      const byRole = {}
      configs.data.forEach(c => { byRole[c.role] = c.permissions })
      const result = {}
      pm.ROLES.forEach(role => {
        result[role] = pm.mergedPerms(role, byRole[role])
      })
      return { code: 0, data: result }
    }

    // 保存某角色权限覆盖（管理员专用）
    case 'save-perm': {
      const { role, permissions } = event
      if (!pm.ROLES.includes(role)) return { code: 400, message: '角色无效' }
      // 保护：锁定权限始终开启（员管理防锁死）
      const list = Array.from(new Set(permissions || [])).filter(k => pm.LOCKED_PERMS[k] ? false : true)
      Object.keys(pm.LOCKED_PERMS).forEach(k => { if (pm.LOCKED_PERMS[k] && role === 'admin') list.push(k) })
      // 校验权限 key 合法
      const allKeys = []
      pm.PERM_GROUPS.forEach(g => g.keys.forEach(k => allKeys.push(k)))
      const valid = list.filter(k => allKeys.includes(k))
      // 锁定权限强制保留：member:manage 仅 admin
      if (role === 'admin' && !valid.includes('member:manage')) valid.push('member:manage')
      const existing = await db.collection('perm_configs').where({ role }).get()
      if (existing.data.length > 0) {
        await db.collection('perm_configs').doc(existing.data[0]._id).update({
          data: { permissions: valid, updatedAt: db.serverDate() }
        })
      } else {
        await db.collection('perm_configs').add({
          data: { role, permissions: valid, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        })
      }
      return { code: 0, data: { role, permissions: valid } }
    }

    // 恢复默认：清空该角色覆盖（回落到全员开放默认）
    case 'reset-perm': {
      const { role } = event
      const existing = await db.collection('perm_configs').where({ role }).get()
      if (existing.data.length > 0) {
        await db.collection('perm_configs').doc(existing.data[0]._id).remove()
      }
      return { code: 0, data: { role, permissions: pm.defaultPermsForRole(role) } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
