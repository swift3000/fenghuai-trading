const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style');
Page({
  data: { uiStyle: '', userInfo: null, userRole: '', roleText: '', userInitial: '',
    autoConfirmEnabled: false, autoConfirmTime: '',
    canViewProducts: false, canViewCustomers: false, canViewReports: false, canManageMembers: false },
  onShow() {
    tabbarHelper.refreshCustomTabBar('profile')
    uiStyle.applyUiStyle(this)
    const userInfo = wx.getStorageSync('userInfo')
    const userRole = wx.getStorageSync('userRole')
    const roleTextMap = { orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员' }
    const perms = (userInfo && userInfo.permissions) || []
    const name = (userInfo && userInfo.name) || '用户'
    this.setData({
      userInfo: userInfo, userRole: userRole, roleText: roleTextMap[userRole] || '',
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
