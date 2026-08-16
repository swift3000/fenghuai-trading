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
    // 阿里语音配置
    aliyunEnabled: '0',
    aliyunAk: '',
    aliyunSk: '',
    aliyunAppKey: '',
    aliyunRegion: 'cn-shanghai',
    aliyunRegionIndex: 0,
    aliyunModel: 'general',
    aliyunModelIndex: 0,
    // 千问配置
    qwenEnabled: '0',
    qwenKey: '',
    qwenModel: 'qwen-turbo',
    qwenModelIndex: 0,
    // 中转站 AI（OpenAI 兼容）配置
    relayEnabled: '0',
    relayBaseUrl: 'https://api.qiyuanapi.cc/v1',
    relayKey: 'sk-opc-ie0JPeJwbnSv7NZZZ6NIuIj2BJSR2RZN',
    relayModel: 'qwen-0810',
    // 定时自动确认（管理员可控）
    acEnabled: '0',
    acTime: '16:00',
  },

  onLoad() {
    uiStyle.applyUiStyle(this)
    if (!guardPageLoad(this)) {
      return
    }
    this.loadUserRole()
    this.loadConfig()
    if (this.data.userRole === 'admin' || wx.getStorageSync('userRole') === 'admin') {
      this.loadAutoConfirm()
    }
  },

  // 加载 AI 配置
  async loadConfig() {
    try {
      const cfg = await callCloud('system', { action: 'getAiConfig' })
      const ai = cfg.ai || {}
      const aliyun = ai.aliyun || {}
      const qwen = ai.qwen || {}
      const relay = ai.relay || {}
      this.setData({
        aliyunEnabled: aliyun.enabled ? '1' : '0',
        aliyunAk: aliyun.accessKeyId || '',
        aliyunSk: aliyun.accessKeySecret || '',
        aliyunAppKey: aliyun.appKey || '',
        aliyunRegion: aliyun.region || 'cn-shanghai',
        aliyunRegionIndex: ['cn-shanghai','cn-beijing','cn-hangzhou'].indexOf(aliyun.region || 'cn-shanghai'),
        aliyunModel: aliyun.model || 'general',
        aliyunModelIndex: aliyun.model === 'telephone' ? 1 : 0,
        qwenEnabled: qwen.enabled ? '1' : '0',
        qwenKey: qwen.apiKey || '',
        qwenModel: qwen.model || 'qwen-turbo',
        qwenModelIndex: ['qwen-turbo','qwen-plus','qwen-max'].indexOf(qwen.model || 'qwen-turbo'),
        relayEnabled: relay.enabled ? '1' : '0',
        relayBaseUrl: relay.baseUrl || '',
        relayKey: relay.apiKey || '',
        relayModel: relay.model || '',
      })
    } catch (e) {
      console.log('加载配置失败', e)
    }
  },

  // 阿里语音配置事件
  onAliyunEnabled(e) { this.setData({ aliyunEnabled: e.detail.value }) },
  onAliyunAk(e) { this.setData({ aliyunAk: e.detail.value }) },
  onAliyunSk(e) { this.setData({ aliyunSk: e.detail.value }) },
  onAliyunAppKey(e) { this.setData({ aliyunAppKey: e.detail.value }) },
  onAliyunRegion(e) {
    const idx = Number(e.detail.value)
    this.setData({ aliyunRegionIndex: idx, aliyunRegion: ['cn-shanghai','cn-beijing','cn-hangzhou'][idx] })
  },
  onAliyunModel(e) {
    const idx = Number(e.detail.value)
    this.setData({ aliyunModelIndex: idx, aliyunModel: idx === 1 ? 'telephone' : 'general' })
  },

  // 千问配置事件
  onQwenEnabled(e) { this.setData({ qwenEnabled: e.detail.value }) },
  onQwenKey(e) { this.setData({ qwenKey: e.detail.value }) },
  onQwenModel(e) {
    const idx = Number(e.detail.value)
    this.setData({ qwenModelIndex: idx, qwenModel: ['qwen-turbo','qwen-plus','qwen-max'][idx] })
  },

  // 中转站 AI 配置事件
  onRelayEnabled(e) { this.setData({ relayEnabled: e.detail.value }) },
  onRelayBaseUrl(e) { this.setData({ relayBaseUrl: e.detail.value }) },
  onRelayKey(e) { this.setData({ relayKey: e.detail.value }) },
  onRelayModel(e) { this.setData({ relayModel: e.detail.value }) },


  // 保存阿里语音配置
  async saveAliyun() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    const ai = cfg.ai || {}
    ai.aliyun = {
      enabled: d.aliyunEnabled === '1',
      accessKeyId: d.aliyunAk,
      accessKeySecret: d.aliyunSk,
      appKey: d.aliyunAppKey,
      region: d.aliyunRegion,
      model: d.aliyunModel
    }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: ai })
    wx.showToast({ title: '阿里语音配置已保存', icon: 'success' })
  },

  // 保存千问配置
  async saveQwen() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    const ai = cfg.ai || {}
    ai.qwen = {
      enabled: d.qwenEnabled === '1',
      apiKey: d.qwenKey,
      model: d.qwenModel
    }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: ai })
    wx.showToast({ title: '千问配置已保存', icon: 'success' })
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
    if (userRole === 'admin') this.loadAutoConfirm()
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
      console.log('加载定时确认配置失败', e)
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

  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
