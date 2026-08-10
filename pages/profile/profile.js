Page({
  data: { userInfo: null, userRole: '', roleText: '', fontSizeScale: 0.9 },
  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    const userRole = wx.getStorageSync('userRole')
    const roleTextMap = { orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员' }
    const fontSizeScale = wx.getStorageSync('fontSizeScale') || 0.9
    this.setData({ userInfo, userRole, roleText: roleTextMap[userRole] || '', fontSizeScale })
  },
  goToProducts() { wx.navigateTo({ url: '/pages/products/products' }) },
  goToCustomers() { wx.navigateTo({ url: '/pages/customers/customers' }) },
  goToReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },
  goToMembers() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/members/members' }) },
  goToSettings() { if (this.data.userRole === 'admin') wx.navigateTo({ url: '/pages/settings/settings' }) },
  changeFontSize(e) {
    const scale = parseFloat(e.detail.value)
    this.setData({ fontSizeScale: scale })
    wx.setStorageSync('fontSizeScale', scale)
    getApp().globalData.fontSizeScale = scale
  },
  handleLogout() {
    wx.showModal({ title: '确认退出', success: res => {
      if (res.confirm) {
        wx.removeStorageSync('userInfo')
        wx.removeStorageSync('userRole')
        wx.reLaunch({ url: '/pages/login/login' })
      }
    }})
  }
})
