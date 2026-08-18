function getAppRef() {
  try { return getApp() || {} } catch (e) { return {} }
}

/**
 * 自定义底部 TabBar（对齐老版原型）：首页 / 订单 / 新建(居中悬浮) / 工作台 / 我的
 * - 新建 = 居中的绿色圆形悬浮按钮，点击 navigateTo 新建订单页
 * - 工作台 = 按角色/权限路由到对应作业页（分拣出库 / 赊销）
 * - 显隐/权限由本组件根据 globalData 自行计算，不依赖原生 tabBar API
 */
Component({
  data: {
    active: '',
    activeColor: '#07C160',
    canCreate: false
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    // 刷新权限（页面 onShow 时调用）
    refresh() {
      const userInfo = ((getAppRef().globalData) || {}).userInfo || {}
      const perms = userInfo.permissions || []
      this.setData({
        canCreate: perms.includes('order:create'),
        activeColor: '#07C160'
      })
    },

    goHome() { wx.switchTab({ url: '/pages/index/index' }) },

    goOrders() { wx.switchTab({ url: '/pages/orders/orders' }) },

    goProfile() { wx.switchTab({ url: '/pages/profile/profile' }) },

    goNew() {
      const userInfo = ((getAppRef().globalData) || {}).userInfo || {}
      const perms = userInfo.permissions || []
      if (!perms.includes('order:create')) {
        wx.showToast({ title: '无新建订单权限', icon: 'none' })
        return
      }
      wx.navigateTo({ url: '/pages/new-order/new-order' })
    },

    goWorkbench() {
      const userInfo = ((getAppRef().globalData) || {}).userInfo || {}
      const perms = userInfo.permissions || []
      const canOut = perms.includes('sort:task') || perms.includes('warehouse:confirm')
      if (canOut) {
        // 分拣员/库管/管理员 -> 分拣出库工作台（真实 Tab 页）
        wx.switchTab({ url: '/pages/outbound/outbound' })
      } else if (perms.includes('receivable:view')) {
        // 下单员 -> 赊销看板
        wx.navigateTo({ url: '/pages/receivable/receivable' })
      } else {
        wx.switchTab({ url: '/pages/orders/orders' })
      }
    }
  }
})
