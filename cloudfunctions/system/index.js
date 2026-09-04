const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// QA 身份模拟钩子（仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时生效，生产不设置→惰性）
let __impersonatedOpenid = null

// 系统配置集合（单文档，_id 固定 'global'）
const CONFIG_DOC = 'global'

// 读取系统配置（含 AI 服务密钥、打印机配置）
async function getConfig() {
  try {
    const res = await db.collection('system_config').doc(CONFIG_DOC).get()
    return res.data || {}
  } catch (e) {
    // 集合不存在或文档不存在时返回空配置
    return {}
  }
}

// 写入系统配置
async function setConfig(data) {
  const payload = { _id: CONFIG_DOC, ...data }
  const { _id: __omit, ...cleanData } = data
  let exists = false
  try {
    const cur = await db.collection('system_config').doc(CONFIG_DOC).get()
    exists = !!(cur && cur.data)
  } catch (e) {
    exists = false
  }
  if (exists) {
    await db.collection('system_config').doc(CONFIG_DOC).update({ data: cleanData })
  } else {
    try {
      await db.collection('system_config').add({ data: payload })
    } catch (e) {
      // 并发创建竞争兜底：已存在则改为 update
      await db.collection('system_config').doc(CONFIG_DOC).update({ data: cleanData })
    }
  }
}

// T51-1：全量分页拉取（服务端单次查询默认 limit=100）
async function fetchAll(query) {
  const size = 100
  const all = []
  for (let skip = 0; ; skip += size) {
    const batch = await query.skip(skip).limit(size).get()
    const data = (batch && batch.data) || []
    all.push(...data)
    if (data.length < size) break
  }
  return all
}

exports.main = async (event, context) => {
  const { action } = event
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const { OPENID: __rawOID } = cloud.getWXContext()
  const OPENID = __impersonatedOpenid || __rawOID

  // 校验管理员权限（member:manage 管理员独占）
  async function checkAdmin() {
    // 后台调用（无微信上下文）时 OPENID 为空，直接拒绝，避免 where({openid: undefined}) 崩溃
    if (!OPENID) return false
    // 与全项目口径一致：用户表以自定义 openid 字段标识用户（auth 登录写入）
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    const user = userRes.data[0]
    if (!user || user.role !== 'admin') {
      return false
    }
    // T55-SC-5：与业务侧 checkPermission 口径统一——禁用账号（status 非 active）一律拒绝
    if (user.status && user.status !== 'active') {
      return false
    }
    return true
  }

  switch (action) {
    case 'getConfig': {
      // 含 AI 服务密钥、打印机配置，仅管理员可读（纵深防御，与 getAiConfig 口径一致）
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const cfg = await getConfig()
      return { code: 0, data: cfg }
    }
    case 'updateConfig': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const { key, value } = event
      const cfg = await getConfig()
      cfg[key] = value
      await setConfig(cfg)
      return { code: 0, data: {} }
    }
    case 'getAiConfig': {
      // 获取 AI 服务配置（阿里语音 + 千问 + 打印机）— 含密钥，仅管理员可读（纵深防御）
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const cfg = await getConfig()
      // T63-7：附带订单号前缀（默认钱多多），设置页可改
      return { code: 0, data: { ai: cfg.ai || {}, printer: cfg.printer || {}, orderPrefix: (typeof cfg.orderPrefix === 'string' && cfg.orderPrefix.trim()) ? cfg.orderPrefix : '钱多多' } }
    }
    case 'updateAiConfig': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const { aiConfig, printer, orderPrefix } = event
      const cfg = await getConfig()
      if (aiConfig) cfg.ai = aiConfig
      if (printer) cfg.printer = printer
      // T63-7：订单号前缀（空串=恢复默认钱多多，orders 云函数读不到有效值时回落 COMPANY_NAME）
      if (orderPrefix !== undefined) cfg.orderPrefix = String(orderPrefix).trim() || '钱多多'
      cfg.updatedAt = db.serverDate()
      await setConfig(cfg)
      return { code: 0, data: {} }
    }
    case 'getAdminWhitelist': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const cfg = await getConfig()
      const wl = Array.isArray(cfg.adminWhitelist) ? cfg.adminWhitelist : []
      // 每个 openid 附带上对应已注册用户的名字（便于管理员辨认）
      // T51-1：全量拉取（注册超 100 人后白名单姓名匹配会漏）
      const users = await fetchAll(db.collection('users').field({ openid: 1, name: 1, role: 1 }))
      const byOpenid = {}
      for (const u of users) byOpenid[u.openid] = u
      return { code: 0, data: { list: wl, mine: OPENID, items: wl.map(o => ({ openid: o, user: byOpenid[o] || null })) } }
    }
    case 'addAdminWhitelist': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const openid = String(event.openid || '').trim()
      if (!openid) return { code: 400, message: 'openid 不能为空' }
      const cfg = await getConfig()
      const wl = Array.isArray(cfg.adminWhitelist) ? cfg.adminWhitelist : []
      if (!wl.includes(openid)) {
        wl.push(openid)
        cfg.adminWhitelist = wl
        cfg.updatedAt = db.serverDate()
        await setConfig(cfg)
      }
      return { code: 0, data: { list: wl } }
    }
    case 'removeAdminWhitelist': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const openid = String(event.openid || '').trim()
      const cfg = await getConfig()
      const wl = Array.isArray(cfg.adminWhitelist) ? cfg.adminWhitelist : []
      cfg.adminWhitelist = wl.filter(o => o !== openid)
      cfg.updatedAt = db.serverDate()
      await setConfig(cfg)
      return { code: 0, data: { list: cfg.adminWhitelist } }
    }
    case 'getAutoConfirm': {
      // 定时自动确认配置（仅管理员可读）：{ enabled, time: '16:00' }
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const cfg = await getConfig()
      const ac = cfg.autoConfirm || {}
      return { code: 0, data: { enabled: !!ac.enabled, time: ac.time || '16:00' } }
    }
    case 'updateAutoConfirm': {
      // 保存定时自动确认配置（仅管理员）。enabled=false 表示不限时（纯人工确认）
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const { enabled, time } = event
      const cfg = await getConfig()
      cfg.autoConfirm = { enabled: !!enabled, time: time || '16:00' }
      cfg.updatedAt = db.serverDate()
      await setConfig(cfg)
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
