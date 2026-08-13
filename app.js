App({
  globalData: {
    userInfo: null,
    userRole: null,
    fontScale: 0.9,
    theme: 'green'
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

    // 初始化主题
    this.initTheme()

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

    // 加载字号设置
    const fontScale = wx.getStorageSync('fontScale')
    if (fontScale !== undefined) {
      this.globalData.fontScale = fontScale
    }

    // 检查是否需要自动登录
    this.checkAutoLogin()
  },

  /**
   * 初始化主题
   */
  initTheme() {
    const themeHelper = require('./utils/theme-helper')
    const savedTheme = wx.getStorageSync('theme') || 'green'
    this.globalData.theme = savedTheme
    themeHelper.setTheme(savedTheme)
    console.log('主题已初始化:', savedTheme)
  },

  /**
   * 设置主题
   * @param {string} themeKey - 主题键值
   */
  setTheme(themeKey) {
    const themeHelper = require('./utils/theme-helper')
    const theme = themeHelper.setTheme(themeKey)
    this.globalData.theme = themeKey
    
    // 通知所有页面更新
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (page.onThemeChange) {
        page.onThemeChange(theme)
      }
    })
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
      } else {
        tabBarHelper.setTabBarByRole(role)
      }
      console.log('TabBar 设置成功')
    } catch (err) {
      console.error('TabBar 设置失败:', err)
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

  // 获取当前主题
  getTheme() {
    return this.globalData.theme
  },

  // 更新字号设置
  setFontScale(scale) {
    this.globalData.fontScale = scale
    wx.setStorageSync('fontScale', scale)
    // 实时通知所有页面刷新字号样式
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (page.onFontScaleChange) {
        page.onFontScaleChange(scale)
      }
    })
  },

  // 更新全局样式（字号）
  updateGlobalStyle() {
    const scale = this.globalData.fontScale
    const rootFontSize = 32 * (1 + scale) // 基础字号 32px，按缩放比例调整
    
    // 设置全局样式
    wx.setStorageSync('globalStyle', {
      rootFontSize
    })
  }
})
