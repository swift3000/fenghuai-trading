const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 权限配置常量
 * 定义各角色的默认权限（20 个权限 key）
 */
const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    permissions: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'sort:task',
      'warehouse:confirm',
      'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount',
      'report:view', 'report:export', 'report:ledger',
      'member:manage', 'permission:manage'
    ]
  },
  orderer: {
    permissions: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'sort:task',
      'warehouse:confirm',
      'receivable:view', 'receivable:collect',
      'report:view', 'report:export', 'report:ledger'
    ]
  },
  sorter: {
    permissions: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'sort:task',
      'warehouse:confirm',
      'receivable:view', 'receivable:collect',
      'report:view', 'report:export', 'report:ledger'
    ]
  },
  warehouse: {
    permissions: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'sort:task',
      'warehouse:confirm',
      'receivable:view', 'receivable:confirm',
      'report:view', 'report:export', 'report:ledger'
    ]
  }
}

/**
 * 生成邀请码（6 位随机字符）
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * auth 云函数入口
 * Actions:
 * - login: 微信登录 + 首管理员自动创建
 * - getInviteCode: 生成邀请码
 * - activateByInvite: 通过邀请码激活
 * - checkAuth: 检查用户权限
 */
exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'login': {
      return await handleLogin(openid, event)
    }
    
    case 'getInviteCode': {
      return await handleGetInviteCode(openid, event)
    }
    
    case 'activateByInvite': {
      return await handleActivateByInvite(openid, event)
    }
    
    case 'checkAuth': {
      return await handleCheckAuth(openid, event)
    }
    
    default:
      return { code: 1001, message: '未知 action' }
  }
}

/**
 * 处理登录
 * 1. 检查用户是否存在
 * 2. 不存在则创建新用户
 * 3. 如果是第一个用户且角色为 admin，自动设为管理员（方案 A 零配置）
 * 4. 返回用户信息
 */
async function handleLogin(openid, event) {
  try {
    const { role = 'orderer', name, phone, region } = event

    // 查询用户是否存在
    let userResult = await db.collection('users').where({ openid }).get()
    
    if (userResult.data.length === 0) {
      // 用户不存在，需要创建
      console.log('新用户登录，openid:', openid)
      
      // 检查是否已有管理员（方案 A 零配置）
      const adminResult = await db.collection('users').where({ role: 'admin' }).count()
      const hasAdmin = adminResult.total > 0
      
      // 如果是第一个用户且请求角色为 admin，自动设为管理员
      const finalRole = (hasAdmin === false && role === 'admin') ? 'admin' : role
      
      console.log('创建新用户，role:', finalRole, 'hasAdmin:', hasAdmin)
      
      const newUser = {
        openid,
        name: name || ('用户' + openid.slice(-4)),
        phone: phone || '',
        region: region || '',
        role: finalRole,
        status: 'active',
        fontScale: 0.9,
        permissions: DEFAULT_ROLE_PERMISSIONS[finalRole]?.permissions || [],
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      
      await db.collection('users').add({ data: newUser })
      
      return {
        code: 0,
        message: '登录成功（新用户）',
        data: {
          userInfo: {
            ...newUser,
            _id: openid // openid 作为唯一标识
          },
          isNewUser: true
        }
      }
    } else {
      // 用户已存在
      const user = userResult.data[0]
      console.log('老用户登录，role:', user.role)
      
      // 同步权限（如果角色未变但权限配置已更新）
      const currentPermissions = DEFAULT_ROLE_PERMISSIONS[user.role]?.permissions || []
      if (!user.permissions || user.permissions.length === 0) {
        // 旧数据没有 permissions 字段，同步一下
        await db.collection('users').doc(user._id).update({
          data: {
            permissions: currentPermissions,
            updatedAt: db.serverDate()
          }
        })
        user.permissions = currentPermissions
      }
      
      return {
        code: 0,
        message: '登录成功',
        data: {
          userInfo: user,
          isNewUser: false
        }
      }
    }
  } catch (err) {
    console.error('登录失败:', err)
    return {
      code: 500,
      message: '登录失败：' + err.message
    }
  }
}

/**
 * 生成邀请码（管理员专用）
 */
async function handleGetInviteCode(opening, event) {
  try {
    const { userId, name, phone, region, role } = event
    
    // 检查权限
    const userResult = await db.collection('users').where({ openid: opening }).get()
    if (userResult.data.length === 0 || userResult.data[0].role !== 'admin') {
      return {
        code: 403,
        message: '无权生成邀请码'
      }
    }
    
    // 检查用户是否存在
    const user = await db.collection('users').doc(userId).get()
    if (user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    // 生成邀请码
    const inviteCode = generateInviteCode()
    const expireTime = new Date()
    expireTime.setDate(expireTime.getDate() + 7) // 7 天有效
    
    // 保存邀请码到用户记录
    await db.collection('users').doc(userId).update({
      data: {
        inviteCode,
        inviteExpire: expireTime,
        inviteStatus: 'pending'
      }
    })
    
    return {
      code: 0,
      data: {
        inviteCode,
        expireTime
      }
    }
  } catch (err) {
    console.error('生成邀请码失败:', err)
    return {
      code: 500,
      message: '生成邀请码失败：' + err.message
    }
  }
}

/**
 * 通过邀请码激活用户
 */
async function handleActivateByInvite(openid, event) {
  try {
    const { inviteCode, role, name, phone, region } = event
    
    // 查找使用邀请码的用户
    const userResult = await db.collection('users').where({
      inviteCode,
      inviteStatus: 'pending'
    }).get()
    
    if (userResult.data.length === 0) {
      return {
        code: 404,
        message: '邀请码无效或已过期'
      }
    }
    
    const user = userResult.data[0]
    
    // 检查邀请是否过期
    if (user.inviteExpire && new Date() > new Date(user.inviteExpire)) {
      return {
        code: 400,
        message: '邀请码已过期'
      }
    }
    
    // 更新用户信息并激活
    await db.collection('users').doc(user._id).update({
      data: {
        openid, // 绑定微信 openid
        role,
        name: name || user.name,
        phone: phone || user.phone,
        region: region || user.region,
        status: 'active',
        permissions: DEFAULT_ROLE_PERMISSIONS[role]?.permissions || [],
        inviteStatus: 'activated',
        activatedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    
    return {
      code: 0,
      message: '激活成功',
      data: {
        userInfo: {
          _id: user._id,
          openid,
          name: user.name,
          role,
          phone: user.phone,
          region: user.region,
          status: 'active',
          permissions: DEFAULT_ROLE_PERMISSIONS[role]?.permissions || []
        }
      }
    }
  } catch (err) {
    console.error('邀请码激活失败:', err)
    return {
      code: 500,
      message: '激活失败：' + err.message
    }
  }
}

/**
 * 检查用户权限
 */
async function handleCheckAuth(openid, event) {
  try {
    const { requiredPermission } = event
    
    const userResult = await db.collection('users').where({ openid }).get()
    if (userResult.data.length === 0) {
      return {
        code: 401,
        message: '用户不存在'
      }
    }
    
    const user = userResult.data[0]
    
    // 检查用户是否被禁用
    if (user.status === 'disabled') {
      return {
        code: 403,
        message: '账号已被禁用'
      }
    }
    
    // 检查权限
    const hasPermission = user.permissions?.includes(requiredPermission)
    
    return {
      code: 0,
      data: {
        hasPermission,
        role: user.role,
        permissions: user.permissions || []
      }
    }
  } catch (err) {
    console.error('权限检查失败:', err)
    return {
      code: 500,
      message: '权限检查失败：' + err.message
    }
  }
}
