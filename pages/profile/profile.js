const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style');
Page({
  data: { uiStyle: '', userInfo: null, userRole: '', roleText: '', userInitial: '', fontSizeScale: 0.9, fontScalePct: 90,
    autoConfirmEnabled: false, autoConfirmTime: '',
    canViewProducts: false, canViewCustomers: false, canViewReports: false, canManageMembers: false },
  onShow() {
    tabbarHelper.refreshCustomTabBar('profile')
    uiStyle.applyUiStyle(this)
    const userInfo = wx.getStorageSync('userInfo')
    const userRole = wx.getStorageSync('userRole')
    const roleTextMap = { orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员' }
    const fontSizeScale = wx.getStorageSync('fontScale') || 0.9
    const perms = (userInfo && userInfo.permissions) || []
    const name = (userInfo && userInfo.name) || '用户'
    this.setData({
      userInfo: userInfo, userRole: userRole, roleText: roleTextMap[userRole] || '', fontSizeScale: fontSizeScale,
      fontScalePct: Math.round(fontSizeScale * 100),
      userInitial: (name || '用').slice(0, 1),
      canViewProducts: perms.includes('product:view'),
      canViewCustomers: perms.includes('customer:view'),
      canViewReports: perms.includes('report:view'),
      canManageMembers: perms.includes('member:manage')
    })
    this.loadAutoConfirm()
  },
  loadAutoConfirm() {
    const that = this
    const { callCloud } = require('../../utils/request')
    callCloud('orders', { action: 'getAutoConfirmPolicy' }).then(function (policy) {
      that.setData({
        autoConfirmEnabled: !!(policy && policy.enabled),
        autoConfirmTime: (policy && policy.time) || ''
      })
    }).catch(function () {})
  },
  goToProducts() { wx.navigateTo({ url: '/pages/products/products' }) },
  goToCustomers() { wx.navigateTo({ url: '/pages/customers/customers' }) },
  goToReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },
  goToMembers() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/members/members' }) },
  goToSettings() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/settings/settings' }) },
  goToAutoConfirm() { wx.navigateTo({ url: '/pages/settings/settings?section=timer' }) },
  openFontPanel() {
    const current = this.data.fontSizeScale
    const presets = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]
    const that = this
    const items = []
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i]
      items.push((p * 100) + (p === current ? '（当前）' : ''))
    }
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        const scale = presets[res.tapIndex]
        that.setData({ fontSizeScale: scale, fontScalePct: Math.round(scale * 100) })
        wx.setStorageSync('fontScale', scale)
        getApp().globalData.fontScale = scale
        uiStyle.applyUiStyle(that)
      }
    })
  },
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需重新登录',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('userRole')
          wx.reLaunch({ url: '/pages/login/login' })
        }
      }
    })
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
