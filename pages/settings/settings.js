// 系统设置页（仅管理员）
// 本组件对齐 UI原型 L1303-L1348（系统设置页）
const { callCloud } = require('../../utils/request')

Page({
  data: {
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
    // 打印机配置
    printerBrand: 'xinye',
    printerBrandIndex: 0,
    printerBrandText: '芯烨（Xprinter）',
    printerWidth: '58',
    printerWidthIndex: 0
  },

  onLoad() {
    this.loadConfig()
  },

  // 加载 AI 配置
  async loadConfig() {
    try {
      const cfg = await callCloud('system', { action: 'getAiConfig' })
      const ai = cfg.ai || {}
      const aliyun = ai.aliyun || {}
      const qwen = ai.qwen || {}
      const printer = cfg.printer || {}
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
        printerBrand: printer.brand || 'xinye',
        printerBrandIndex: ['xinye','jiabo','hanyin'].indexOf(printer.brand || 'xinye'),
        printerBrandText: {xinye:'芯烨（Xprinter）',jiabo:'佳博（Gprinter）',hanyin:'汉印（HPRT）'}[printer.brand || 'xinye'],
        printerWidth: printer.width || '58',
        printerWidthIndex: printer.width === '80' ? 1 : 0
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

  // 打印机配置事件
  onPrinterBrand(e) {
    const idx = Number(e.detail.value)
    this.setData({
      printerBrandIndex: idx,
      printerBrand: ['xinye','jiabo','hanyin'][idx],
      printerBrandText: ['芯烨（Xprinter）','佳博（Gprinter）','汉印（HPRT）'][idx]
    })
  },
  onPrinterWidth(e) {
    const idx = Number(e.detail.value)
    this.setData({ printerWidthIndex: idx, printerWidth: idx === 1 ? '80' : '58' })
  },

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

  // 保存打印机配置
  async savePrinter() {
    const d = this.data
    const cfg = await callCloud('system', { action: 'getAiConfig' })
    cfg.printer = { brand: d.printerBrand, width: d.printerWidth }
    await callCloud('system', { action: 'updateAiConfig', aiConfig: cfg.ai || {}, printer: cfg.printer })
    wx.showToast({ title: '打印机配置已保存', icon: 'success' })
  }
})
