App({
  globalData: {
    userInfo: null,
    userRole: null,
    fontScale: 1.0,
  },

  onLaunch() {
    console.log('=== App 启动 ===')

    // 初始化云开发环境
    if (!wx.cloud.config) {
      console.log('初始化云开发环境:', 'cloud1-d6g75loi673b1e039')
      wx.cloud.init({
        env: 'cloud1-d6g75loi673b1e039',
        traceUser: true,
        debug: true
      })
    }


    // 从本地缓存加载用户信息
    const userInfo = wx.getStorageSync('userInfo')
    console.log('本地缓存用户信息:', userInfo)
    
    if (userInfo && userInfo.role) {
      this.globalData.userInfo = userInfo
      this.globalData.userRole = userInfo.role
      console.log('已加载用户信息:', userInfo.name, '角色:', userInfo.role)
      
      // 根据权限设置 TabBar（有权限数组按权限键；否则回退按角色）
      this.updateTabBarByRole(userInfo.role, userInfo.permissions)
    }

    // 字号跟随微信系统设置（微信 设置→通用→字体大小），不再提供应用内调节
    this.globalData.fontScale = this.systemFontScale()

    // 检查是否需要自动登录
    this.checkAutoLogin()
  },


  checkAutoLogin() {
    if (this.globalData.userInfo && this.globalData.userRole) {
      // 已登录，根据角色自动跳转
      console.log('检测到已登录，自动跳转')
      this.updateTabBarByRole(this.globalData.userRole)
      this.redirectByRole(this.globalData.userRole)
    }
  },

  /**
   * 根据角色更新 TabBar
   * @param {string} role - 用户角色
   */
  updateTabBarByRole(role, permissions) {
    const tabBarHelper = require('./utils/tabbar-helper')
    
    console.log('updateTabBarByRole 执行，角色:', role)
    
    try {
      if (permissions && permissions.length) {
        tabBarHelper.setTabBarByPerms(permissions)
        console.log('✅ TabBar 设置成功（基于权限）')
      } else {
        tabBarHelper.setTabBarByRole(role)
        console.log('✅ TabBar 设置成功（基于角色）')
      }
      return { success: true, message: 'TabBar 设置成功' }
    } catch (err) {
      console.error('❌ TabBar 设置失败:', err)
      return { success: false, error: err.message }
    }
  },

  redirectByRole(role) {
    // 根据角色自动跳转（分拣员/库管进入「分拣出库」工作台，与 login 导航一致）
    switch (role) {
      case 'sorter':
      case 'warehouse':
        wx.reLaunch({ url: '/pages/outbound/outbound' })
        break
      default:
        wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  // 权限检查工具方法
  hasPermission(permission) {
    const userInfo = this.globalData.userInfo
    if (!userInfo || !userInfo.permissions) {
      return false
    }
    return userInfo.permissions.includes(permission)
  },

  // 获取当前用户角色
  getRole() {
    return this.globalData.userRole
  },

  // 获取当前用户信息
  getUserInfo() {
    return this.globalData.userInfo
  },

  // 系统字号映射：微信 设置→通用→字体大小 → --font-scale 系数
  systemFontScale() {
    try {
      const s = wx.getSystemInfoSync().fontSizeSetting
      const map = { mini: 0.85, small: 0.92, standard: 1.0, large: 1.1, extraLarge: 1.2 }
      return map[s] || 1.0
    } catch (e) {
      return 1.0
    }
  },

  // 更新字号设置
  setFontScale(scale) {
    this.globalData.fontScale = scale
    // 实时通知所有页面刷新字号样式
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (typeof page.onFontScaleChange === 'function') {
        page.onFontScaleChange(scale)
      }
    })
    // 自定义 TabBar 组件同步缩放（组件不在页面 data 级联链上）
    if (pages && pages.length) {
      const page = pages[pages.length - 1]
      if (typeof page.getTabBar === 'function') {
        const bar = page.getTabBar()
        if (bar && typeof bar.onFontScaleChange === 'function') bar.onFontScaleChange(scale)
      }
    }
  },

})
