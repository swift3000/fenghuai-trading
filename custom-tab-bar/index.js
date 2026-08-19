Component({
  data: {
    active: '',
    activeColor: '#07C160'
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    // 刷新（页面 onShow 时调用）
    refresh() {
      this.setData({ activeColor: '#07C160' })
    },

    goHome() { wx.switchTab({ url: '/pages/index/index' }) },
    goOrders() { wx.switchTab({ url: '/pages/orders/orders' }) },
    goReceivable() { wx.switchTab({ url: '/pages/receivable/receivable' }) },
    goOutbound() { wx.switchTab({ url: '/pages/outbound/outbound' }) },
    goProfile() { wx.switchTab({ url: '/pages/profile/profile' }) }
  }
})
