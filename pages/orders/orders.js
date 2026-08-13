const { guardPageLoad } = require('../../utils/router-guard')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    timeTab: 'today',
    searchKey: '',
    orders: [],
    groups: [],
    tabs: [
      { key: 'today', label: '今日' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: 'all', label: '全部' }
    ],
    canCreateOrder: false
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    this.setData({ canCreateOrder: perms.includes('order:create') })
  },

  onShow() {
    uiStyle.applyUiStyle(this)
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
      // 付款状态标签: 未付款/未结清/已结清（对齐原型 payChip）
      const decorated = (orders || []).map(o => {
        const ps = o.paymentStatus || o.payment_status || 'unpaid'
        let payLabel = '未付款'
        let payClass = 'uc'
        if (ps === 'paid') { payLabel = '已结清'; payClass = 'pd' }
        else if (ps === 'pending') { payLabel = '未结清'; payClass = 'pg' }
        return Object.assign({}, o, {
          payLabel,
          payClass,
          timeText: o.created_at ? new Date(o.created_at).toLocaleString('zh-CN') : ''
        })
      })
      // 客户分组展示（对齐原型：今日按客户分组卡片，历史折叠）
      const groups = []
      const map = {}
      decorated.forEach(o => {
        const cid = o.customerId || o.customerName
        if (!map[cid]) {
          map[cid] = { name: o.customerName, region: o.customerRegion || '', orders: [], totalAmount: 0 }
          groups.push(map[cid])
        }
        map[cid].orders.push(o)
        map[cid].totalAmount += Number(o.totalAmount || 0)
      })
      this.setData({ orders: decorated, groups })
    } catch (e) {
      console.log('加载订单失败', e)
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
  },

  // 分组点击：跳转到该分组第一笔订单（对齐原型点击客户分组卡片）
  goToGroup(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
    }
  },

  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' })
  },
  onThemeChange(theme) {
    uiStyle.applyUiStyle(this)

    console.log('主题已切换:', theme.name)
    // 页面可以在这里添加自定义逻辑
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
