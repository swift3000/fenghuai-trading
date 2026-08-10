Page({
  data: {
    timeTab: 'today',
    searchKey: '',
    orders: [],
    tabs: [
      { key: 'today', label: '今日' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: 'all', label: '全部' }
    ]
  },

  onLoad() {},

  onShow() {
    this.loadOrders()
  },

  switchTab(e) {
    this.setData({ timeTab: e.currentTarget.dataset.key })
    this.loadOrders()
  },

  onSearch(e) {
    this.setData({ searchKey: e.detail.value })
    this.loadOrders()
  },

  async loadOrders() {
    try {
      const { callCloud } = require('../../utils/request')
      const orders = await callCloud('orders', {
        action: 'list',
        timeTab: this.data.timeTab,
        searchKey: this.data.searchKey
      })
      this.setData({ orders: orders || [] })
    } catch (e) {
      console.log('加载订单失败', e)
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
  },

  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' })
  }
})
