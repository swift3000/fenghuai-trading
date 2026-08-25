const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试（与其他业务云函数同机制）。
let __impersonatedOpenid = null

// 引入权限矩阵
let pmShared
try {
  pmShared = require('./perm-matrix-shared.js')
} catch (e) {
  // 单一来源加载失败必须报错：禁止静默使用降级权限（旧降级表与真实矩阵不一致，会给出错误权限集）
  console.error('perm-matrix-shared.js 加载失败，auth 无法确定权限，终止', e)
  throw e
}

/**
 * 读取某角色在 perm_configs 中的覆盖，合并默认得到有效权限
 */
async function effectivePermsForRole(role) {
  try {
    const cfg = await db.collection('perm_configs').where({ role }).get()
    // 无覆盖时必须传 undefined（mergedPerms 第二参非 null 时只做「baseline+覆盖」，
    // 传 [] 会把新用户权限缩成只剩 baseline，导致邀请进来的用户几乎没有任何权限）
    const overrides = (cfg.data && cfg.data[0] && cfg.data[0].permissions) || null
    return pmShared.mergedPerms(role, overrides ? overrides : undefined)
  } catch (e) {
    console.log('获取角色权限失败，使用默认权限:', e.message)
    return pmShared.defaultPermsForRole(role)
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
 * 生成邀请小程序码
 */
async function generateInviteQR(inviteCode) {
  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: 'invite=' + inviteCode,
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
 */
exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const openid = __impersonatedOpenid || wxContext.OPENID

  console.log('auth 云函数调用，action:', action, 'openid:', openid)

  if (!openid) {
    return { code: 500, message: '无法获取 OPENID，请检查云函数配置' }
  }

  switch (action) {
    case 'login':
      return await handleLogin(openid, event)
    case 'getInviteCode':
      return await handleGetInviteCode(openid, event)
    case 'activateByInvite':
      return await handleActivateByInvite(openid, event)
    case 'checkAuth':
      return await handleCheckAuth(openid, event)
    default:
      return { code: 1001, message: '未知 action' }
  }
}

// ===== 默认管理员白名单（防体验版"谁先扫谁是管理员"，T47）=====
async function getAdminWhitelist() {
  try {
    const r = await db.collection('system_config').doc('global').get()
    const wl = (r.data && r.data.adminWhitelist) || []
    return Array.isArray(wl) ? wl.filter(x => typeof x === 'string' && x) : []
  } catch (e) { return [] }
}
async function isWhitelistedAdmin(openid) {
  const wl = await getAdminWhitelist()
  return wl.includes(openid)
}
// 白名单内已注册且未禁用的账号幂等提升为管理员
async function syncWhitelistAdmin(openid, user) {
  if (!user || user.role === 'admin' || user.status === 'disabled') return
  if (await isWhitelistedAdmin(openid)) {
    const pm = require('./perm-matrix-shared')
    await db.collection('users').doc(user._id).update({ data: {
      role: 'admin',
      permissions: pm.defaultPermsForRole('admin') || [],
      updatedAt: db.serverDate()
    } })
    user.role = 'admin'
  }
}

/**
 * 处理登录
 */
async function handleLogin(openid, event) {
  try {
    const { role = 'orderer', name, phone, region, inviteCode } = event

    console.log('handleLogin 开始，openid:', openid, 'inviteCode:', inviteCode)

    // 查询用户是否存在
    const userResult = await db.collection('users').where({ openid }).get()

    if (userResult.data.length === 0) {
      // 用户不存在
      console.log('新用户登录')

      // 邀请绑定
      if (inviteCode) {
        let inviteResult
        try {
          inviteResult = await db.collection('users').where({ inviteCode, inviteStatus: 'pending' }).get()
        } catch (err) {
          console.error('查询邀请码失败:', err)
          inviteResult = { data: [] }
        }

        if (inviteResult.data.length === 0) {
          return { code: 401, message: '邀请码无效或已过期' }
        }

        const pre = inviteResult.data[0]
        if (pre.inviteExpire && new Date() > new Date(pre.inviteExpire)) {
          return { code: 400, message: '邀请码已过期' }
        }

        let finalRole = pre.role || 'orderer'
        if (await isWhitelistedAdmin(openid)) finalRole = 'admin'
        const permissions = await effectivePermsForRole(finalRole)

        await db.collection('users').doc(pre._id).update({
          data: {
            openid,
            name: name || pre.name || ('用户' + openid.slice(-4)),
            phone: phone || pre.phone || '',
            region: region || pre.region || '',
            role: finalRole,
            status: 'active',
            inviteStatus: 'activated',
            activatedAt: db.serverDate(),
            permissions,
            updatedAt: db.serverDate()
          }
        })

        const activated = await db.collection('users').doc(pre._id).get()
        console.log('邀请绑定激活成功')

        return {
          code: 0,
          message: '登录成功（邀请绑定）',
          data: {
            userInfo: activated.data,
            isNewUser: true
          }
        }
      }

      // 检查是否已有管理员
      let adminResult
      try {
        adminResult = await db.collection('users').where({ role: 'admin' }).count()
      } catch (err) {
        console.error('查询管理员失败:', err)
        adminResult = { total: 0 }
      }

      const hasAdmin = adminResult.total > 0
      const inWhitelist = await isWhitelistedAdmin(openid)
      const finalRole = inWhitelist ? 'admin' : (hasAdmin ? 'orderer' : 'admin')

      console.log('创建新用户，role:', finalRole)

      const permissions = await effectivePermsForRole(finalRole)

      const newUser = {
        openid,
        name: name || ('用户' + openid.slice(-4)),
        phone: phone || '',
        region: region || '',
        role: finalRole,
        status: 'active',
        permissions,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      await db.collection('users').add({ data: newUser })

      return {
        code: 0,
        message: '登录成功' + (finalRole === 'admin' ? '（首位管理员）' : '（新用户）'),
        data: {
          userInfo: {
            ...newUser,
            _id: openid
          },
          isNewUser: true
        }
      }
    } else {
      // 用户已存在
      const user = userResult.data[0]
      // 白名单账号同步提升为管理员（幂等）
      await syncWhitelistAdmin(openid, user)
      console.log('老用户登录，role:', user.role)

      // 待确认成员（管理端预建、已绑 openid）登录即自动激活；禁用账号拦截
      if (user.status === 'pending') {
        await db.collection('users').doc(user._id).update({
          data: { status: 'active', activatedAt: db.serverDate(), updatedAt: db.serverDate() }
        })
        user.status = 'active'
      }
      if (user.status === 'disabled') {
        return { code: 403, message: '账号已被禁用' }
      }

      // 同步权限
      try {
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
      } catch (err) {
        console.error('同步权限失败:', err)
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
 * 生成邀请码
 */
async function handleGetInviteCode(openid, event) {
  try {
    const { name, phone, region, role = 'orderer' } = event

    const userResult = await db.collection('users').where({ openid }).get()
    if (userResult.data.length === 0 || userResult.data[0].role !== 'admin') {
      return { code: 403, message: '仅管理员可生成邀请码' }
    }

    const inviteCode = generateInviteCode()
    const inviteQr = await generateInviteQR(inviteCode)

    // 邀请 7 天有效
    const inviteExpire = new Date()
    inviteExpire.setDate(inviteExpire.getDate() + 7)

    const inviteCodeDoc = {
      inviteCode,
      name,
      phone: phone || '',
      region: region || '',
      role,
      status: 'pending',
      inviteExpire,
      inviteStatus: 'pending',
      inviteQr,
      createdBy: openid,
      createdAt: db.serverDate()
    }

    const result = await db.collection('users').add({ data: inviteCodeDoc })

    return {
      code: 0,
      message: '邀请码生成成功',
      data: {
        inviteCode,
        inviteQr,
        _id: result._id
      }
    }
  } catch (err) {
    console.error('生成邀请码失败:', err)
    return { code: 500, message: '生成邀请码失败：' + err.message }
  }
}

/**
 * 通过邀请码激活
 */
async function handleActivateByInvite(openid, event) {
  try {
    const { inviteCode } = event

    const inviteResult = await db.collection('users').where({ inviteCode, inviteStatus: 'pending' }).get()
    if (inviteResult.data.length === 0) {
      return { code: 404, message: '邀请码无效或已使用' }
    }

    const pre = inviteResult.data[0]
    if (pre.inviteExpire && new Date() > new Date(pre.inviteExpire)) {
      return { code: 400, message: '邀请码已过期' }
    }

    const finalRole = pre.role || 'orderer'
    const permissions = await effectivePermsForRole(finalRole)

    await db.collection('users').doc(pre._id).update({
      data: {
        openid,
        inviteStatus: 'activated',
        activatedAt: db.serverDate(),
        permissions,
        updatedAt: db.serverDate()
      }
    })

    const activated = await db.collection('users').doc(pre._id).get()

    return {
      code: 0,
      message: '激活成功',
      data: {
        userInfo: activated.data
      }
    }
  } catch (err) {
    console.error('激活失败:', err)
    return { code: 500, message: '激活失败：' + err.message }
  }
}

/**
 * 检查权限
 */
async function handleCheckAuth(openid, event) {
  try {
    const { requiredPermission } = event

    const userResult = await db.collection('users').where({ openid }).get()
    if (userResult.data.length === 0) {
      return { code: 401, message: '用户不存在' }
    }

    const user = userResult.data[0]

    // 检查用户是否被禁用
    if (user.status === 'disabled') {
      return { code: 403, message: '账号已被禁用' }
    }

    const hasPermission = user.role === 'admin'
      || (user.permissions || []).includes(requiredPermission)

    return {
      code: 0,
      data: {
        hasPermission,
        role: user.role,
        permissions: user.permissions || []
      }
    }
  } catch (err) {
    console.error('检查权限失败:', err)
    return { code: 500, message: '检查权限失败：' + err.message }
  }
}
