const { guardPageLoad } = require('../../utils/router-guard')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    reportTab: 'product',
    timeTab: 'day',
    totalAmount: 0,
    totalQty: 0,
    productCount: 0,
    totalOrders: 0,
    customerCount: 0,
    paymentCount: 0,
    data: [],
    canExport: false,
    regionOptions: ['全部'],
    regionIndex: 0
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    this.setData({ canExport: perms.includes('report:export') })
    this.loadRegions()
    this.loadData()
  },

  // 加载区域下拉
  async loadRegions() {
    try {
      const { callCloud } = require('../../utils/request')
      const orders = await callCloud('orders', { action: 'list', timeTab: 'all' })
      const regions = [...new Set((orders || []).map(o => o.customerRegion).filter(r => r))]
      this.setData({ regionOptions: ['全部', ...regions] })
    } catch (e) {}
  },

  // 切换区域
  onRegionChange(e) {
    this.setData({ regionIndex: e.detail.value })
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
      const region = this.data.regionIndex > 0 ? this.data.regionOptions[this.data.regionIndex] : ''
      const data = await callCloud('report', {
        action: 'summary',
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab,
        region
      })
      
      const hasData = reportTab === 'product'
        ? (data.products || []).length > 0
        : reportTab === 'customer'
          ? (data.customers || []).length > 0
          : (data.methods || []).length > 0
      this.setData({
        ...data,
        data: data, // 保持 WXML 读取 data.products/customers/methods
        hasData,
        loading: false
      })
    } catch (e) {
      console.error('加载数据失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 通用导出器：调用指定 report action 并保存 CSV
  async doReportExport(action, okTitle) {
    try {
      wx.showLoading({ title: '导出中...' })
      const { callCloud } = require('../../utils/request')
      const region = this.data.regionIndex > 0 ? this.data.regionOptions[this.data.regionIndex] : ''
      const result = await callCloud('report', {
        action,
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab,
        region,
        format: 'csv'
      })
      const { csvContent, filename } = result || {}
      if (!csvContent) {
        wx.showToast({ title: '没有可导出的数据', icon: 'none' })
        return
      }
      const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
      wx.getFileSystemManager().writeFileSync(filePath, csvContent, 'utf8')
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      wx.showToast({ title: '已导出到临时目录', icon: 'success' })
      wx.showModal({
        title: '导出成功',
        content: `${okTitle}文件已保存到:\n${filePath}\n\n您可以通过文件管理工具获取 CSV 文件`,
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 导出报表
  handleExport() {
    this.doReportExport('export', '报表')
  },

  // 客户汇总表（外县台账式）
  handleExportDailySummary() {
    this.doReportExport('exportDailySummary', '客户汇总表')
  },

  // 收款台账（外县格式）
  handleExportLedger() {
    this.doReportExport('exportLedger', '收款台账')
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '丰淮商贸报表',
      path: '/pages/reports/reports'
    }
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
