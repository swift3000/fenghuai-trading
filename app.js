App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      traceUser: true
    })
    this.globalData = {
      userInfo: null,
      userRole: null,
      fontSizeScale: 0.9
    }
    const fontSizeScale = wx.getStorageSync('fontSizeScale')
    if (fontSizeScale) {
      this.globalData.fontSizeScale = fontSizeScale
    }
  },
  globalData: {
    userInfo: null,
    userRole: null,
    fontSizeScale: 0.9
  }
})
