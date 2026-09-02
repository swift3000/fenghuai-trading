// 系统设置页（仅管理员）
// 本组件对齐 UI原型 L1303-L1348（系统设置页）
const { callCloud } = require('../../utils/request')
const { guardPageLoad } = require('../../utils/router-guard')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    // 用户角色
    userRole: '',
    // 订单号前缀（T63-7）
    orderPrefix: '乾多多',
    // 腾讯云语音（ASR）配置
    tencentEnabled: '0',
    tencentSid: '',
    tencentSkey: '',
    tencentEngine: '16k_zh',
    tencentEngineIndex: 0,
    // TokenHub NLP 配置（腾讯云 OpenAI 兼容，独立密钥）
    nlpEnabled: '0',
    nlpModel: 'hy3',
    nlpModelIndex: 0,
    nlpModels: ['hy3','glm-5.3','deepseek-v4-flash','deepseek-v4-flash-202605','kimi-k3','kimi-k2.7-code-highspeed','glm-5.2','kimi-k2.7-code','minimax-m3','deepseek-v4-pro-202606','deepseek-v4-pro','mimo-v2.5-pro','glm-5.1','glm-5','glm-5v-turbo','glm-5-turbo','kimi-k2.6','minimax-m2.7','hy-role','hunyuan-role-latest','hy-mt2-pro','hy-mt2-plus','hy-mt2-lite'],
    tokenhubKey: '',
    // 中转站 AI（OpenAI 兼容）配置
    relayEnabled: '0',
    relayBaseUrl: 'https://api.qiyuanapi.cc/v1',
    relayKey: '',
    relayModel: 'qwen-0810',
    // 定时自动确认（管理员可控）
    acEnabled: '0',
    acTime: '16:00',
    // 默认管理员白名单（防体验版抢首登）
    wlItems: [],
    wlMine: '',
    wlInput: '',
    // 打印机配置（蓝牙打印）
    printerBrand: 'xinye',
    printerBrandIndex: 0,
    printerWidth: '58',
    printerWidthIndex: 0,
  },

  onLoad(options) {
    uiStyle.applyUiStyle(this)
    if (!guardPageLoad(this)) {
      return
    }
    this._pendingSection = (options && options.section) || ''
    this.loadUserRole()
    this.loadConfig()
    if (this.data.userRole === 'admin' || wx.getStorageSync('userRole') === 'admin') {
      this.loadAutoConfirm()
    }
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    if (this.data.userRole === 'admin') this.scrollToSection()
  },

  // 从「我的-定时自动确认」入口带 section 参数进入时，滚动定位到对应区块
  scrollToSection(retry) {
    const sec = this._pendingSection
    if (!sec || this.data.userRole !== 'admin') return
    const map = { timer: 'sec-timer' }
    const elId = map[sec]
    if (!elId) return
    const tryScroll = (attempt) => {
      const q = wx.createSelectorQuery()
      q.select('#' + elId).boundingClientRect()
            q.selectViewport().scrollOffset()
            q.exec(res => {
        const rect = res && res[0]
        const off = res && res[1]
        const curTop = off ? off.scrollTop : 0
        if (rect && rect.width > 0) {
          this._pendingSection = ''
          wx.pageScrollTo({ scrollTop: Math.max(curTop + rect.top - 120, 0), duration: 200 })
        } else if (attempt < 5) {
          setTimeout(() => tryScroll(attempt + 1), 150)
        } else {
          this._pendingSection = ''
        }
      })
    }
    // 延迟执行，等待 admin 区块渲染完成（onShow 可能早于 setData 渲染）
    setTimeout(() => tryScroll(0), retry ? 0 : 300)
  },

  // 加载 AI 配置
  async loadConfig() {
    try {
      const cfg = await callCloud('system', { action: 'getAiConfig' })
      const ai = cfg.ai || {}
      const tencent = ai.tencent || {}
      const th = ai.tokenhub || {}
      const relay = ai.relay || {}
      this.setData({
        tencentEnabled: tencent.enabled ? '1' : '0',
        tencentSid: tencent.secretId || '',
        tencentSkey: tencent.secretKey || '',
        tencentEngine: tencent.engine || '16k_zh',
        tencentEngineIndex: tencent.engine === '8k_zh' ? 1 : 0,
        nlpEnabled: th.enabled ? '1' : '0',
        nlpModel: th.model || 'hy3',
        nlpModelIndex: Math.max(0, this.data.nlpModels.indexOf(th.model || 'hy3')),
        tokenhubKey: th.apiKey || '',
        relayEnabled: relay.enabled ? '1' : '0',
        relayBaseUrl: relay.baseUrl || '',
        relayKey: relay.apiKey || '',
        relayModel: relay.model || '',
      })
      const printer = cfg.printer || {}
      const brands = ['xinye', 'jiabo', 'hanyin']
      const widths = ['58', '80']
      this.setData({
        printerBrand: brands.includes(printer.brand) ? printer.brand : 'xinye',
        printerBrandIndex: Math.max(0, brands.indexOf(printer.brand || 'xinye')),
        printerWidth: widths.includes(printer.width) ? printer.width : '58',
        printerWidthIndex: Math.max(0, widths.indexOf(printer.width || '58')),
      })
      this.setData({ orderPrefix: cfg.orderPrefix || '乾多多' })
    } catch (e) {
      console.error('加载配置失败', e)
    }
  },

  // 腾讯云语音配置事件
  onTencentEnabled(e) { this.setData({ tencentEnabled: e.detail.value }) },
  onTencentSid(e) { this.setData({ tencentSid: e.detail.value }) },
  onTencentSkey(e) { this.setData({ tencentSkey: e.detail.value }) },
  onTencentEngine(e) {
    const idx = Number(e.detail.value)
    this.setData({ tencentEngineIndex: idx, tencentEngine: idx === 1 ? '8k_zh' : '16k_zh' })
  },

  // TokenHub NLP 配置事件
  onNlpEnabled(e) { this.setData({ nlpEnabled: e.detail.value }) },
  onNlpModel(e) {
    const idx = Number(e.detail.value)
    this.setData({ nlpModelIndex: idx, nlpModel: this.data.nlpModels[idx] })
  },
  onTokenhubKey(e) { this.setData({ tokenhubKey: e.detail.value }) },

  // 中转站 AI 配置事件
  onRelayEnabled(e) { this.setData({ relayEnabled: e.detail.value }) },
  onRelayBaseUrl(e) { this.setData({ relayBaseUrl: e.detail.value }) },
  onRelayKey(e) { this.setData({ relayKey: e.detail.value }) },
  onRelayModel(e) { this.setData({ relayModel: e.detail.value }) },

  // 打印机配置事件
  onPrinterBrand(e) {
    const idx = Number(e.detail.value)
    this.setData({ printerBrandIndex: idx, printerBrand: ['xinye', 'jiabo', 'hanyin'][idx] })
  },
  onPrinterWidth(e) {
    const idx = Number(e.detail.value)
    this.setData({ printerWidthIndex: idx, printerWidth: ['58', '80'][idx] })
  },

  // 保存打印机配置
  async savePrinter() {
    await callCloud('system', {
      action: 'updateAiConfig',
      printer: { brand: this.data.printerBrand, width: this.data.printerWidth }
    })
    wx.showToast({ title: '打印机配置已保存', icon: 'success' })
  },

  // 订单号前缀（T63-7）
  onOrderPrefix(e) { this.setData({ orderPrefix: e.detail.value }) },
  async saveOrderPrefix() {
    const p = String(this.data.orderPrefix || '').trim() || '乾多多'
    await callCloud('system', { action: 'updateAiConfig', orderPrefix: p })
    this.setData({ orderPrefix: p })
    wx.showToast({ title: '订单号前缀已保存', icon: 'success' })
  },


  // 保存腾讯云语音配置
  async saveTencent() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    const ai = cfg.ai || {}
    ai.tencent = {
      enabled: d.tencentEnabled === '1',
      secretId: d.tencentSid,
      secretKey: d.tencentSkey,
      engine: d.tencentEngine
    }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: ai })
    wx.showToast({ title: '腾讯云配置已保存', icon: 'success' })
  },

  // 保存 TokenHub NLP 配置（独立密钥，OpenAI 兼容）
  async saveTokenhub() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    const ai = cfg.ai || {}
    ai.tokenhub = {
      enabled: d.nlpEnabled === '1',
      apiKey: d.tokenhubKey,
      baseUrl: 'https://tokenhub.tencentmaas.com/v1',
      model: d.nlpModel
    }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: ai })
    wx.showToast({ title: 'TokenHub 配置已保存', icon: 'success' })
  },

  // 保存中转站 AI 配置
  async saveRelay() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    const ai = cfg.ai || {}
    ai.relay = {
      enabled: d.relayEnabled === '1',
      baseUrl: d.relayBaseUrl,
      apiKey: d.relayKey,
      model: d.relayModel
    }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: ai })
    wx.showToast({ title: '中转站 AI 配置已保存', icon: 'success' })
  },

  // 加载用户角色
  loadUserRole() {
    const userRole = wx.getStorageSync('userRole') || ''
    this.setData({ userRole })
    // 角色确定后补加载定时确认配置
    if (userRole === 'admin') {
      this.loadAutoConfirm()
      this.loadWhitelist()
    }
  },

  // 加载定时自动确认配置
  async loadAutoConfirm() {
    try {
      const cfg = await callCloud('system', { action: 'getAutoConfirm' })
      this.setData({
        acEnabled: cfg.enabled ? '1' : '0',
        acTime: cfg.time || '16:00'
      })
    } catch (e) {
      console.error('加载定时确认配置失败', e)
    }
  },
  onAcEnabled(e) {
    this.setData({ acEnabled: e.detail.value })
  },
  onAcTime(e) {
    this.setData({ acTime: e.detail.value })
  },
  // 保存定时自动确认配置
  async saveAutoConfirm() {
    try {
      await callCloud('system', {
        action: 'updateAutoConfirm',
        enabled: this.data.acEnabled === '1',
        time: this.data.acTime
      })
      wx.showToast({ title: '定时确认已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ===== 默认管理员白名单 =====
  async loadWhitelist() {
    try {
      const r = await callCloud('system', { action: 'getAdminWhitelist' })
      this.setData({ wlItems: r.items || [], wlMine: r.mine || '' })
    } catch (e) {
      console.error('加载管理员白名单失败', e)
    }
  },
  onWlInput(e) {
    this.setData({ wlInput: e.detail.value })
  },
  // 一键把当前登录账号（我自己）设为默认管理员
  async wlAddMine() {
    if (!this.data.wlMine) { wx.showToast({ title: '无法获取当前openid', icon: 'none' }); return }
    try {
      await callCloud('system', { action: 'addAdminWhitelist', openid: this.data.wlMine })
      wx.showToast({ title: '已设为默认管理员', icon: 'success' })
      this.loadWhitelist()
    } catch (e) {
      wx.showToast({ title: '设置失败', icon: 'none' })
    }
  },
  // 手动输入 openid 添加
  async wlAddInput() {
    const openid = (this.data.wlInput || '').trim()
    if (!openid) { wx.showToast({ title: '请输入 openid', icon: 'none' }); return }
    try {
      await callCloud('system', { action: 'addAdminWhitelist', openid })
      wx.showToast({ title: '已添加', icon: 'success' })
      this.setData({ wlInput: '' })
      this.loadWhitelist()
    } catch (e) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },
  wlRemoveTap(e) {
    const oid = (e.currentTarget.dataset && e.currentTarget.dataset.oid) || ''
    if (!oid) return
    this.wlRemove(oid)
  },
  async wlRemove(openid) {
    try {
      await callCloud('system', { action: 'removeAdminWhitelist', openid })
      wx.showToast({ title: '已移除', icon: 'success' })
      this.loadWhitelist()
    } catch (e) {
      wx.showToast({ title: '移除失败', icon: 'none' })
    }
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
