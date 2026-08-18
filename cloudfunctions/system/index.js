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
      return { code: 0, data: { ai: cfg.ai || {}, printer: cfg.printer || {} } }
    }
    case 'updateAiConfig': {
      if (!(await checkAdmin())) return { code: 2001, message: '无权限' }
      const { aiConfig, printer } = event
      const cfg = await getConfig()
      if (aiConfig) cfg.ai = aiConfig
      if (printer) cfg.printer = printer
      cfg.updatedAt = db.serverDate()
      await setConfig(cfg)
      return { code: 0, data: {} }
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
