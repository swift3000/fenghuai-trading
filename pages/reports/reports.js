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
    regionIndex: 0,
    // 自定义时间区间
    startDate: '',
    endDate: ''
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
    if (timeTab !== 'custom') this.loadData()
  },

  // 自定义时间区间
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },
  applyCustomDate() {
    if (!this.data.startDate || !this.data.endDate) return
    this.loadData()
  },

  // 加载数据
  async loadData() {
    try {
      this.setData({ loading: true })
      const { callCloud } = require('../../utils/request')
      const region = this.data.regionIndex > 0 ? this.data.regionOptions[this.data.regionIndex] : ''
      const params = {
        action: 'summary',
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab,
        region
      }
      if (this.data.timeTab === 'custom') {
        if (!this.data.startDate || !this.data.endDate) { this.setData({ loading: false }); return }
        params.startDate = this.data.startDate
        params.endDate = this.data.endDate
      }
      const data = await callCloud('report', params)
      
      const reportTab = this.data.reportTab
      const hasData = reportTab === 'product'
        ? (data.products || []).length > 0
        : reportTab === 'customer'
          ? (data.customers || []).length > 0
          : (data.methods || []).length > 0
      // T46: 汇总卡与 tab 解耦——独立走 main 口径（该时间段订单总数+订单总金额），
      // 不再随 tab 切换变化，避免「收款台账 tab 今日=0」的口径困惑
      let main = { totalOrders: 0, totalAmount: 0 }
      try {
        const mainParams = { action: 'summary', reportTab: 'main', timeTab: this.data.timeTab, region }
        if (this.data.timeTab === 'custom') {
          mainParams.startDate = this.data.startDate
          mainParams.endDate = this.data.endDate
        }
        main = await callCloud('report', mainParams)
      } catch (e) {
        // main 口径失败时回退当前 tab 数据，不阻塞列表展示
        main = { totalOrders: data.totalOrders != null ? data.totalOrders : 0, totalAmount: data.totalAmount != null ? data.totalAmount : 0 }
      }
      this.setData({
        ...data,
        data: data, // 保持 WXML 读取 data.products/customers/methods
        hasData,
        totalOrders: main.totalOrders != null ? main.totalOrders : 0,
        totalAmount: main.totalAmount != null ? main.totalAmount : 0,
        loading: false
      })
    } catch (e) {
      console.error('加载数据失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 选择导出格式（默认 Excel）
  pickExportFormat() {
    return new Promise(resolve => {
      wx.showActionSheet({
        itemList: ['Excel 表格（推荐）', 'CSV 文本'],
        success: res => resolve(res.tapIndex === 0 ? 'excel' : 'csv'),
        fail: () => resolve('excel')
      })
    })
  },
  // 保存导出文件：excel 下载云文件并打开（右上角可转发/保存），csv 写本地文件
  saveExportFile(result, fmt) {
    if (fmt === 'excel' && result && result.fileID) {
      return new Promise((resolve, reject) => {
        wx.downloadFile({
          url: result.fileID,
          success: d => {
            if (d.statusCode !== 200) return reject(new Error('download fail'))
            wx.openDocument({
              filePath: d.tempFilePath,
              showMenu: true,
              fileName: result.filename || 'export.xlsx',
              success: () => resolve(true),
              fail: () => resolve(d.tempFilePath)
            })
          },
          fail: reject
        })
      })
    }
    if (result && result.csvContent) {
      const fn = result.filename || ('export_' + Date.now() + '.csv')
      const filePath = wx.env.USER_DATA_PATH + '/' + fn
      wx.getFileSystemManager().writeFileSync(filePath, result.csvContent, 'utf8')
      return Promise.resolve(filePath)
    }
    return Promise.resolve(null)
  },


  // 通用导出器：调用指定 report action，支持 Excel / CSV 两种格式
  async doReportExport(action, okTitle) {
    const fmt = await this.pickExportFormat()
    try {
      wx.showLoading({ title: '导出中...' })
      const { callCloud } = require('../../utils/request')
      const region = this.data.regionIndex > 0 ? this.data.regionOptions[this.data.regionIndex] : ''
      if (this.data.timeTab === 'custom' && (!this.data.startDate || !this.data.endDate)) {
        wx.hideLoading()
        wx.showToast({ title: '请先选择时间区间', icon: 'none' })
        return
      }
      const expParams = {
        action,
        reportTab: this.data.reportTab,
        timeTab: this.data.timeTab,
        region,
        format: fmt
      }
      if (this.data.timeTab === 'custom') {
        expParams.startDate = this.data.startDate
        expParams.endDate = this.data.endDate
      }
      const result = await callCloud('report', expParams)
      const hasData = fmt === 'excel' ? !!(result && result.fileID) : !!(result && result.csvContent)
      if (!hasData) {
        wx.hideLoading()
        wx.showToast({ title: '没有可导出的数据', icon: 'none' })
        return
      }
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      if (fmt === 'excel') {
        wx.hideLoading()
        wx.showLoading({ title: '打开 Excel...' })
        await this.saveExportFile(result, 'excel')
        wx.hideLoading()
        wx.showToast({ title: '已打开 Excel，可转发', icon: 'success' })
        return
      }
      const filePath = await this.saveExportFile(result, 'csv')
      wx.hideLoading()
      wx.showToast({ title: '已导出 CSV', icon: 'success' })
      wx.showModal({
        title: '导出成功',
        content: okTitle + '文件已保存到:\n' + filePath + '\n\n您可以通过文件管理工具获取该文件',
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
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
