const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null

const _ = db.command
const pm = require('./perm-matrix-shared.js')

/**
 * 读取 perm_configs 全部覆盖；集合不存在（首次使用）时回落到空数组，避免 502005 抛错
 */
async function readPermConfigs() {
  try {
    const c = await db.collection('perm_configs').get()
    return c.data || []
  } catch (e) {
    if (e && (e.errCode === -502005 || /collection not exist/i.test(e.message || ''))) return []
    throw e
  }
}

/**
 * 按 role 查 perm_configs 已有记录 _id；不存在返回 null
 */
async function findPermDocId(role) {
  try {
    const c = await db.collection('perm_configs').where({ role }).get()
    return (c.data && c.data[0] && c.data[0]._id) || null
  } catch (e) {
    if (e && (e.errCode === -502005 || /collection not exist/i.test(e.message || ''))) return null
    throw e
  }
}

// 将某角色的“有效权限（默认+覆盖）”回写到该角色所有用户的 user.permissions，
// 使业务云函数 checkPermission（读 user.permissions 快照）即时生效，
// 对齐“改动即时保存生效”的产品口径（否则要等用户下次登录才同步）。
async function syncUsersPermissionsForRole(role) {
  // mergedPerms 第二参必须是「权限数组」(无覆盖时传 undefined 回落默认)。
  // 注意：perm_configs 文档是 {role, permissions:[...]}，不能把整个文档对象传进去，
  // 否则 (overrides||[]).filter 报 not a function，同步静默失败 → 开关不即时生效。
  const cfg = (await readPermConfigs()).find(c => c.role === role)
  const effective = pm.mergedPerms(role, cfg ? cfg.permissions : undefined)
  // 不用 where({role})：CF 侧 where 偶发返回空（与 where({openid}) 同类问题），会导致同步漏写、开关不生效。
  // 改为全量取回 + 内存过滤，保证该角色所有用户都被回写。
  const list = await db.collection('users').limit(1000).get()
  let n = 0
  for (const u of list.data) {
    if (u.role !== role) continue
    if (!u.permissions || JSON.stringify(u.permissions) !== JSON.stringify(effective)) {
      await db.collection('users').doc(u._id).update({ data: { permissions: effective, updatedAt: db.serverDate() } })
      n++
    }
  }
  return { role, effective: effective, updated: n }
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const wxContext = cloud.getWXContext()
  const openid = __impersonatedOpenid || wxContext.OPENID
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
  const self = authResult.user || {}
  // 前端成员管理页传的是 doc._id，而防御需同时兼容 _id 与 openid 两种标识，
  // 否则 event.userId===openid 永远不成立，防自删/防自改角色/防自禁用保护形同虚设
  const isSelf = (id) => !!(id && (id === self._id || id === self.openid || id === openid))

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
      // 对齐原型二级「添加成员」弹窗：openid 选填——填则直接激活，留空为 pending（邀请扫码绑定）
      const { name, phone, region, role, openid: newOpenid } = event
      const hasOpenid = !!(newOpenid && String(newOpenid).trim())
      if (hasOpenid) {
        const dup = await db.collection('users').where({ openid: String(newOpenid).trim() }).count()
        if (dup.total > 0) return { code: 400, message: '该微信已绑定成员' }
      }
      const newUser = {
        name,
        phone: phone || '',
        region: region || '',
        role: role || 'orderer',
        status: hasOpenid ? 'active' : 'pending',
        openid: hasOpenid ? String(newOpenid).trim() : '',
        permissions: [], // 根据角色自动分配
        createdBy: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      // 权限单一事实源：共享矩阵（perm-matrix-shared.js）
      newUser.permissions = pm.defaultPermsForRole(role) || []

      const res = await db.collection('users').add({ data: newUser })
      return { code: 0, data: { _id: res._id } }
    }

    case 'remove': {
      // 移除用户（不能移除自己）
      if (isSelf(event.userId)) {
        return { code: 400, message: '无法移除自己' }
      }

      let target
      try {
        target = (await db.collection('users').doc(event.userId).get()).data
      } catch (e) {
        return { code: 404, message: '用户不存在' }
      }
      // 防锁死（对齐原型 deleteMember）：管理员可删，但须至少保留一名管理员
      if (target.role === 'admin') {
        const adminRes = await db.collection('users').where({ role: 'admin' }).get()
        if (adminRes.data.length <= 1) {
          return { code: 400, message: '至少保留一名管理员，无法删除' }
        }
      }

      await db.collection('users').doc(event.userId).remove()
      return { code: 0, data: {} }
    }

    case 'update-role': {
      // 更新用户角色
      if (isSelf(event.userId)) {
        return { code: 400, message: '无法修改自己的角色' }
      }

      let target2
      try {
        target2 = (await db.collection('users').doc(event.userId).get()).data
      } catch (e) {
        return { code: 404, message: '用户不存在' }
      }
      if (target2.role === 'admin' && event.role !== 'admin') {
        return { code: 400, message: '无法移除管理员权限' }
      }

      // 权限单一事实源：共享矩阵
      await db.collection('users').doc(event.userId).update({
        data: {
          role: event.role,
          permissions: pm.defaultPermsForRole(event.role) || [],
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: {} }
    }

    case 'update-status': {
      // 禁用/启用用户
      if (isSelf(event.userId)) {
        return { code: 400, message: '无法禁用自己' }
      }
      let st = event.status
      // 兼容旧值 inactive → disabled
      if (st === 'inactive') st = 'disabled'
      if (st !== 'active' && st !== 'disabled') {
        return { code: 400, message: '无效状态值（应为 active 或 disabled）' }
      }
      await db.collection('users').doc(event.userId).update({
        data: {
          status: st,
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: {} }
    }


    // 读取各角色实际权限（默认+覆盖）
    case 'perm-config': {
      const configs = await readPermConfigs()
      const byRole = {}
      configs.forEach(c => { byRole[c.role] = c.permissions })
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
      const existId = await findPermDocId(role)
      if (existId) {
        await db.collection('perm_configs').doc(existId).update({
          data: { permissions: valid, updatedAt: db.serverDate() }
        })
      } else {
        await db.collection('perm_configs').add({
          data: { role, permissions: valid, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        })
      }
      // 即时同步到该角色所有用户，使开关立即生效（对齐“改动即时保存生效”）
      let sync = { updated: 0 }
      try { sync = await syncUsersPermissionsForRole(role) } catch (e) { console.error('sync perms failed', e) }
      return { code: 0, data: { role, permissions: valid, syncedUsers: sync.updated } }
    }

    // 恢复默认：清空该角色覆盖（回落到全员开放默认）
    case 'reset-perm': {
      const { role } = event
      const existId = await findPermDocId(role)
      if (existId) {
        await db.collection('perm_configs').doc(existId).remove()
      }
      // 即时同步默认权限到该角色所有用户
      let sync = { updated: 0 }
      try { sync = await syncUsersPermissionsForRole(role) } catch (e) { console.error('sync perms failed', e) }
      return { code: 0, data: { role, permissions: pm.defaultPermsForRole(role), syncedUsers: sync.updated } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
