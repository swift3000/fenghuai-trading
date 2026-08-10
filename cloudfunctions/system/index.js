const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
  try {
    await db.collection('system_config').doc(CONFIG_DOC).set({ data })
  } catch (e) {
    // 文档不存在时用 add 创建
    await db.collection('system_config').add({ data: { _id: CONFIG_DOC, ...data } })
  }
}

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  // 校验管理员权限（member:manage 管理员独占）
  async function checkAdmin() {
    const userRes = await db.collection('users').where({ _openid: OPENID }).get()
    const user = userRes.data[0]
    if (!user || user.role !== 'admin') {
      return false
    }
    return true
  }

  switch (action) {
    case 'getConfig': {
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
      // 获取 AI 服务配置（阿里语音 + 千问 + 打印机）
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
    default:
      return { code: 1001, message: '未知 action' }
  }
}
