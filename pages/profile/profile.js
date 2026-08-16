const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style');
Page({
  data: { uiStyle: '', userInfo: null, userRole: '', roleText: '', fontSizeScale: 0.9,
    canViewProducts: false, canViewCustomers: false, canViewReports: false, canManageMembers: false },
  onShow() {
    tabbarHelper.refreshCustomTabBar('profile')
    uiStyle.applyUiStyle(this)
    const userInfo = wx.getStorageSync('userInfo')
    const userRole = wx.getStorageSync('userRole')
    const roleTextMap = { orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员' }
    const fontSizeScale = wx.getStorageSync('fontScale') || 0.9
    const perms = (userInfo && userInfo.permissions) || []
    this.setData({
      userInfo, userRole, roleText: roleTextMap[userRole] || '', fontSizeScale,
      canViewProducts: perms.includes('product:view'),
      canViewCustomers: perms.includes('customer:view'),
      canViewReports: perms.includes('report:view'),
      canManageMembers: perms.includes('member:manage')
    })
  },
  goToProducts() { wx.navigateTo({ url: '/pages/products/products' }) },
  goToCustomers() { wx.navigateTo({ url: '/pages/customers/customers' }) },
  goToReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },
  goToMembers() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/members/members' }) },
  goToSettings() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/settings/settings' }) },
  changeFontSize(e) {
    const scale = parseFloat(e.detail.value)
    this.setData({ fontSizeScale: scale })
    wx.setStorageSync('fontScale', scale)
    getApp().globalData.fontScale = scale
    // 重新注入样式（含字号缩放）实时生效
    uiStyle.applyUiStyle(this)
  },
  handleLogout() {
    wx.showModal({ title: '确认退出', success: res => {
      if (res.confirm) {
        wx.removeStorageSync('userInfo')
        wx.removeStorageSync('userRole')
        wx.reLaunch({ url: '/pages/login/login' })
      }
    }})
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
