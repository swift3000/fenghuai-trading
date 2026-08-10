Page({
  data: {
    roles: [
      { key: 'orderer', name: '下单员', icon: '📝' },
      { key: 'sorter', name: '分拣员', icon: '📦' },
      { key: 'warehouse', name: '库管', icon: '' },
      { key: 'admin', name: '管理员', icon: '👑' }
    ],
    selectedRole: '',
    isFirstAdmin: false
  },

  onLoad() {
    this.checkFirstAdmin()
  },

  async checkFirstAdmin() {
    try {
      const { callCloud } = require('../../utils/request')
      const users = await callCloud('users', { action: 'list' })
      const hasAdmin = users.some(u => u.role === 'admin')
      if (!hasAdmin) {
        this.setData({ isFirstAdmin: true })
      }
    } catch (e) {
      console.log('检查管理员状态失败', e)
    }
  },

  selectRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role })
  },

  async handleLogin() {
    if (!this.data.selectedRole) {
      wx.showToast({ title: '请选择角色', icon: 'none' })
      return
    }
    wx.showLoading({ title: '登录中...' })
    try {
      const { callCloud } = require('../../utils/request')
      const result = await callCloud('auth', {
        action: 'login',
        role: this.data.selectedRole
      })
      const app = getApp()
      app.globalData.userInfo = result.userInfo
      app.globalData.userRole = result.userInfo.role
      wx.setStorageSync('userInfo', result.userInfo)
      wx.setStorageSync('userRole', result.userInfo.role)
      wx.hideLoading()
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
  }
})
