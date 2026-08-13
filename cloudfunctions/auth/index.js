const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 权限配置常量
 * 定义各角色的默认权限（20 个权限 key）
 */
const pmShared = require('../perm-matrix-shared.js')

/**
 * 读取某角色在 perm_configs 中的覆盖，合并默认得到有效权限
 */
async function effectivePermsForRole(role) {
  try {
    const cfg = await db.collection('perm_configs').where({ role }).get()
    const overrides = (cfg.data && cfg.data[0] && cfg.data[0].permissions) || []
    return pmShared.mergedPerms(role, overrides)
  } catch (e) {
    return pmShared.defaultPermsForRole(role)
  }
}

const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    permissions: [
      'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'sort:task',
      'warehouse:confirm',
      'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount',
      'report:view', 'report:export', 'report:ledger',
      'member:manage'
    ]
  },
  orderer: {
    permissions: [
      'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
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
      'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
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
      'order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
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
 * 生成邀请小程序码（scene 携带邀请码），上传云存储返回 fileID
 * 扫码后进入小程序（登录页 onLoad 读取 options.scene 解析），自动带出邀请码完成绑定
 */
async function generateInviteQR(inviteCode) {
  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: 'invite=' + inviteCode, // 场景值（扫码进入后的 options.scene）
      page: 'pages/login/login',
      checkPath: false,
      width: 280,
      envVersion: 'release'
    })
    const buffer = result.buffer
    const upload = await cloud.uploadFile({
      cloudPath: 'invite/' + inviteCode + '.png',
      fileContent: buffer
    })
    return upload.fileID
  } catch (err) {
    console.error('生成邀请小程序码失败:', err)
    return null
  }
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
    const { role = 'orderer', name, phone, region, inviteCode } = event

    // 查询用户是否存在
    let userResult = await db.collection('users').where({ openid }).get()
    
    if (userResult.data.length === 0) {
      // 用户不存在
      console.log('新用户登录，openid:', openid, 'inviteCode:', inviteCode || '无')

      // 邀请绑定：携带邀请码且存在待激活用户 → 绑定 openid，并按管理员预设角色激活
      if (inviteCode) {
        const inviteResult = await db.collection('users').where({ inviteCode, inviteStatus: 'pending' }).get()
        if (inviteResult.data.length === 0) {
          return { code: 401, message: '邀请码无效或已过期' }
        }
        const pre = inviteResult.data[0]
        if (pre.inviteExpire && new Date() > new Date(pre.inviteExpire)) {
          return { code: 400, message: '邀请码已过期' }
        }
        const finalRole = pre.role || 'orderer'
        await db.collection('users').doc(pre._id).update({
          data: {
            openid,
            name: name || pre.name || ('用户' + openid.slice(-4)),
            phone: phone || pre.phone || '',
            region: region || pre.region || '',
            role: finalRole,
            status: 'active',
            fontScale: 0.9,
            inviteStatus: 'activated',
            activatedAt: db.serverDate(),
            permissions: await effectivePermsForRole(finalRole),
            updatedAt: db.serverDate()
          }
        })
        const activated = await db.collection('users').doc(pre._id).get()
        console.log('邀请绑定激活成功，role:', finalRole)
        return {
          code: 0,
          message: '登录成功（邀请绑定）',
          data: {
            userInfo: activated.data,
            isNewUser: true
          }
        }
      }

      // 非邀请：检查是否已有管理员（方案 A 零配置）
      const adminResult = await db.collection('users').where({ role: 'admin' }).count()
      const hasAdmin = adminResult.total > 0
      
      // 首管理员（方案 A 零配置）：系统尚无任何管理员时，第一位登录者无条件成为管理员
      // （登录页不再允许自选角色，角色统一由后端决定，避免任意人自选 admin/库管的越权）
      const finalRole = (hasAdmin === false) ? 'admin' : role
      
      console.log('创建新用户，role:', finalRole, 'hasAdmin:', hasAdmin)
      
      const newUser = {
        openid,
        name: name || ('用户' + openid.slice(-4)),
        phone: phone || '',
        region: region || '',
        role: finalRole,
        status: 'active',
        fontScale: 0.9,
        permissions: await effectivePermsForRole(finalRole),
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
      
      // 同步权限：管理员改权限开关(perm_configs)后，老用户每次登录都刷新覆盖后权限
      const currentPermissions = await effectivePermsForRole(user.role)
      if (!user.permissions || JSON.stringify(user.permissions) !== JSON.stringify(currentPermissions)) {
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
    const { name, phone, region, role = 'orderer' } = event
    
    // 检查权限：仅管理员
    const userResult = await db.collection('users').where({ openid: opening }).get()
    if (userResult.data.length === 0 || userResult.data[0].role !== 'admin') {
      return {
        code: 403,
        message: '无权生成邀请码'
      }
    }
    
    // 生成邀请码（6 位，7 天有效）
    const inviteCode = generateInviteCode()
    const expireTime = new Date()
    expireTime.setDate(expireTime.getDate() + 7) // 7 天有效
    
    // 创建一个「待激活」用户，邀请码作为其注册凭据
    const preUser = {
      name: name || '',
      phone: phone || '',
      region: region || '',
      role: role,
      status: 'pending',
      fontScale: 0.9,
      permissions: [],
      inviteCode,
      inviteExpire: expireTime,
      inviteStatus: 'pending',
      createdBy: opening,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    const res = await db.collection('users').add({ data: preUser })
    
    // 生成邀请小程序码（scene 携带邀请码）：扫码进入登录页自动带出邀请码并绑定
    const qrFileID = await generateInviteQR(inviteCode)
    
    // 回写小程序码 fileID
    if (qrFileID) {
      await db.collection('users').doc(res._id).update({ data: { inviteQr: qrFileID } })
    }
    
    return {
      code: 0,
      data: {
        userId: res._id,
        inviteCode,
        expireTime,
        role,
        qrFileID
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
        permissions: await effectivePermsForRole(role),
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
          permissions: await effectivePermsForRole(role)
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
