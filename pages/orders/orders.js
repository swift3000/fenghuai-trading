const { guardPageLoad } = require('../../utils/router-guard')
const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style')

Page({
  data: {
    uiStyle: '',
    timeTab: 'today',
    searchKey: '',
    orders: [],
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
    uiStyle.applyUiStyle(this)
    const app = getApp()
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    this.setData({ canCreateOrder: perms.includes('order:create') })
  },

  onShow() {
    tabbarHelper.refreshCustomTabBar('orders')
    // 承接首页全局搜索：Tab 页无法带参，用全局变量传递一次性关键词
    const app = getApp()
    if (app.globalData.pendingOrderSearch !== undefined) {
      const kw = app.globalData.pendingOrderSearch
      app.globalData.pendingOrderSearch = undefined
      this.setData({ searchKey: kw, timeTab: 'all' })
    }
    this.loadOrders()
  },

  switchTab(e) {
    this.setData({ timeTab: e.currentTarget.dataset.key })
    this.loadOrders()
  },

  onSearch(e) {
    const keyword = e.detail.value || ''
    
    // 清除之前的定时器
    if (this.data.orderDebounceTimer) {
      clearTimeout(this.data.orderDebounceTimer)
    }
    
    // 设置新的防抖定时器（300ms）
    const timer = setTimeout(() => {
      this.setData({ searchKey: keyword })
      this.loadOrders()
    }, 300)
    
    this.setData({ orderDebounceTimer: timer })
  },

  async loadOrders() {
    try {
      const { callCloud } = require('../../utils/request')
      const orders = await callCloud('orders', {
        action: 'list',
        timeTab: this.data.timeTab,
        searchKey: this.data.searchKey
      })
      
      // 装饰订单数据（对齐原型样式）
      const decorated = (orders || []).map(o => {
        // 付款状态标签
        const ps = o.paymentStatus || o.payment_status || 'unpaid'
        // 付款标签口径（对齐老版原型）：unpaid=未付款 / pending(部分收款)=未结清 / paid=已结清
        let payLabel = '未付款'
        let payClass = 'unpaid'
        if (ps === 'paid') { payLabel = '已结清'; payClass = 'paid' }
        else if (ps === 'pending' || ps === 'partial') { payLabel = '未结清'; payClass = 'partial' }
        
        // 订单状态标签（status 值域对齐云函数：submitted/sorted/confirmed）
        let statusText = '待分拣'
        let statusClass = 'pending'
        const status = o.status || o.orderStatus || 'submitted'
        if (status === 'sorted') { statusText = '已分拣'; statusClass = 'processing' }
        else if (status === 'confirmed') { statusText = '已出库'; statusClass = 'completed' }
        
        // 计算商品数量（0件0包 的行不展示）
        const viewItems = (o.items || [])
          .filter(it => (it.piece_qty || 0) > 0 || (it.package_qty != null ? it.package_qty : (it.zero_qty || 0)) > 0)
          .map(it => {
            const pq = it.piece_qty || 0
            const zq = it.package_qty != null ? it.package_qty : (it.zero_qty || 0)
            const amt = it.amount != null ? it.amount : (pq * (it.price_piece || 0) + zq * (it.price_unit != null ? it.price_unit : (it.price_zero || 0)))
            return { ...it, qtyText: (pq > 0 ? pq + '件' : '') + (pq > 0 && zq > 0 ? '+' : '') + (zq > 0 ? zq + '包' : ''), amountText: amt > 0 ? amt : '' }
          })
        const itemCount = viewItems.length || o.itemCount || 0
        
        return {
          ...o,
          items: viewItems,
          payLabel,
          payClass,
          statusText,
          statusClass,
          itemCount,
          region: o.customerRegion || o.region || '',
          totalAmount: Number(o.totalAmount) || 0,
          timeText: o.created_at ? new Date(o.created_at).toLocaleString('zh-CN', { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : ''
        }
      })
      
      this.setData({ orders: decorated })
    } catch (e) {
      console.error('加载订单失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
  },

  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' })
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  }
})
