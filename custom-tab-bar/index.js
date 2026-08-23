Component({
  data: {
    active: '',
    activeColor: '#07C160',
    tabStyle: ''
  },

  lifetimes: {
    attached() {
      this.refresh()
      this.applyFontScale()
    }
  },

  methods: {
    // 字号缩放跟随（tabbar 是组件，页面根变量的级联不生效，需自身注入 --font-scale）
    applyFontScale() {
      let fs = 1
      try {
        const app = getApp()
        if (app && app.globalData && Number.isFinite(Number(app.globalData.fontScale))) {
          fs = Number(app.globalData.fontScale)
        }
      } catch (e) {}
      fs = Math.min(1.3, Math.max(0.7, fs))
      this.setData({ tabStyle: '--font-scale:' + fs + ';' })
    },
    onFontScaleChange() {
      this.applyFontScale()
    },
    // 刷新（页面 onShow 时调用）
    refresh() {
      this.setData({ activeColor: '#07C160' })
      this.applyFontScale()
    },

    goHome() { wx.switchTab({ url: '/pages/index/index' }) },
    goOrders() { wx.switchTab({ url: '/pages/orders/orders' }) },
    goReceivable() { wx.switchTab({ url: '/pages/receivable/receivable' }) },
    goOutbound() { wx.switchTab({ url: '/pages/outbound/outbound' }) },
    goProfile() { wx.switchTab({ url: '/pages/profile/profile' }) }
  }
})
