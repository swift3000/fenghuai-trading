Page({
  data: {
    userInfo: null,
    userRole: '',
    roleText: '',
    todayOrders: 0,
    todayAmount: 0,
    recentOrders: [],
    notices: ['欢迎使用丰淮商贸采购下单助手']
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadTodayStats()
    this.loadRecentOrders()
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    const userRole = wx.getStorageSync('userRole')
    const roleTextMap = { orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员' }
    this.setData({
      userInfo,
      userRole,
      roleText: roleTextMap[userRole] || ''
    })
  },

  async loadTodayStats() {
    try {
      const { callCloud } = require('../../utils/request')
      const stats = await callCloud('orders', { action: 'todayStats' })
      this.setData({ todayOrders: stats.count || 0, todayAmount: stats.amount || 0 })
    } catch (e) {
      console.log('加载今日统计失败', e)
    }
  },

  async loadRecentOrders() {
    try {
      const { callCloud } = require('../../utils/request')
      const orders = await callCloud('orders', { action: 'list', limit: 5 })
      this.setData({ recentOrders: orders || [] })
    } catch (e) {
      console.log('加载最近订单失败', e)
    }
  },

  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' })
  },

  goToProducts() {
    wx.navigateTo({ url: '/pages/products/products' })
  },

  goToCustomers() {
    wx.navigateTo({ url: '/pages/customers/customers' })
  },

  goToSmartInput() {
    this.setData({ showSmartInput: true })
  },

  goToAllOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  }
})
