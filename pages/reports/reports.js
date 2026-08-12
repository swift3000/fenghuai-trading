const { guardPageLoad } = require('../../utils/router-guard')

Page({
  data: {
    reportTab: 'product',
    timeTab: 'day',
    totalAmount: 0,
    totalQty: 0,
    productCount: 0,
    totalOrders: 0,
    customerCount: 0,
    paymentCount: 0,
    data: []
  },

  onShow() {
    if (!guardPageLoad(this)) {
      return
    }
    this.loadData()
  },

  // 切换报表类型
  switchTab(e) {
    const reportTab = e.currentTarget.dataset.tab
    this.setData({ 
      reportTab,
      data: []
    })
    this.loadData()
  },

  // 切换时间范围
  switchTime(e) {
    const timeTab = e.currentTarget.dataset.key
    this.setData({ timeTab })
    this.loadData()
  },

  // 加载数据
  async loadData() {
    try {
      this.setData({ loading: true })
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('report', {
        action: 'summary',
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab
      })
      
      this.setData({
        ...data,
        loading: false
      })
    } catch (e) {
      console.error('加载数据失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 导出报表
  async handleExport() {
    try {
      wx.showLoading({ title: '导出中...' })
      
      const { callCloud } = require('../../utils/request')
      const result = await callCloud('report', {
        action: 'export',
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab,
        format: 'csv'
      })
      
      const { csvContent, filename } = result.data
      
      if (!csvContent) {
        wx.showToast({ title: '没有可导出的数据', icon: 'none' })
        return
      }
      
      // 将 CSV 内容保存到临时文件
      const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, csvContent, 'utf8')
      
      // 分享文件
      wx.showShareMenu({
        withShareTicket: true,
        shareTypes: [1, 2]
      })
      
      wx.showToast({ title: '已导出到临时目录', icon: 'success' })
      
      // 提示用户如何获取文件
      wx.showModal({
        title: '导出成功',
        content: `文件已保存到:\n${filePath}\n\n您可以通过文件管理工具获取 CSV 文件`,
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '丰淮商贸报表',
      path: '/pages/reports/reports'
    }
  }
})
