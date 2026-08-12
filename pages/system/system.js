const { guardPageLoad } = require('../../utils/router-guard')
const { callCloud } = require('../../utils/request')

Page({
  data: {
    aiConfig: {
      appKey: '',
      accessKeyId: '',
      accessKeySecret: '',
      qwenApiKey: '',
      qwenModel: 'qwen-turbo'
    },
    printerConfig: {
      apiUrl: '',
      apiKey: '',
      printerId: '',
      paperWidth: '58'
    },
    qwenModelOptions: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-max-longcontext'
    ],
    qwenModelIndex: 0,
    saving: false
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
    this.loadConfig()
  },

  async loadConfig() {
    wx.showLoading({ title: '加载中...' })
    try {
      const config = await callCloud('system', { action: 'getAiConfig' })
      
      if (config.ai) {
        this.setData({ aiConfig: { ...this.data.aiConfig, ...config.ai } })
        
        // 设置模型索引
        const modelIndex = this.data.qwenModelOptions.indexOf(config.ai.qwenModel)
        if (modelIndex >= 0) {
          this.setData({ qwenModelIndex: modelIndex })
        }
      }
      
      if (config.printer) {
        this.setData({ printerConfig: { ...this.data.printerConfig, ...config.printer } })
      }
    } catch (e) {
      wx.showToast({ title: '加载配置失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onAiInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`aiConfig.${field}`]: value
    })
  },

  onPrinterInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`printerConfig.${field}`]: value
    })
  },

  onQwenModelChange(e) {
    const index = e.detail.value
    const model = this.data.qwenModelOptions[index]
    this.setData({
      qwenModelIndex: index,
      [`aiConfig.qwenModel`]: model
    })
  },

  async saveConfig() {
    // 验证必填项
    const { aiConfig, printerConfig } = this.data
    
    if (!aiConfig.appKey) {
      wx.showToast({ title: '请输入阿里云 AppKey', icon: 'none' })
      return
    }
    if (!aiConfig.accessKeyId) {
      wx.showToast({ title: '请输入阿里云 AccessKey ID', icon: 'none' })
      return
    }
    if (!aiConfig.accessKeySecret) {
      wx.showToast({ title: '请输入阿里云 AccessKey Secret', icon: 'none' })
      return
    }
    if (!aiConfig.qwenApiKey) {
      wx.showToast({ title: '请输入千问模型 API Key', icon: 'none' })
      return
    }

    try {
      this.setData({ saving: true })
      wx.showLoading({ title: '保存中...' })

      await callCloud('system', {
        action: 'updateAiConfig',
        aiConfig: {
          appKey: aiConfig.appKey,
          accessKeyId: aiConfig.accessKeyId,
          accessKeySecret: aiConfig.accessKeySecret,
          qwenApiKey: aiConfig.qwenApiKey,
          qwenModel: aiConfig.qwenModel
        },
        printerConfig: {
          apiUrl: printerConfig.apiUrl,
          apiKey: printerConfig.apiKey,
          printerId: printerConfig.printerId,
          paperWidth: parseInt(printerConfig.paperWidth) || 58
        }
      })

      wx.showToast({ title: '保存成功' })
      this.loadConfig()
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
