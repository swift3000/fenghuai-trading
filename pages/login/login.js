const app = getApp();

Page({
  data: {
    isFirstAdmin: false,
    loading: false
  },

  onLoad() {
    this.checkFirstAdmin();
  },

  // 检查是否是首位管理员（本机尚未有已登录用户时为首次启动）
  checkFirstAdmin() {
    const hasLocalUser = wx.getStorageSync('userInfo') || wx.getStorageSync('firstAdmin');
    if (!hasLocalUser) {
      this.setData({ isFirstAdmin: true });
    }
  },

  // 处理登录（对接 auth 云函数，换取真实 openid）
  async handleLogin() {
    const { loading } = this.data;
    
    if (loading) return;
    
    this.setData({ loading: true });
    
    try {
      const { callCloud } = require('../../utils/request');
      // 调用 auth/login：微信云函数内自动取 OPENID 并决定角色
      // 角色不再由前端自选：首管理员自动为 admin，其余由后端/管理员分配，避免越权
      const result = await callCloud('auth', {
        action: 'login'
      });
      const userInfo = result.userInfo || {};
      
      // 角色以服务端为准
      const role = userInfo.role || 'orderer';
      
      // 统一写入 globalData 与本地缓存（供 profile/index/路由守卫使用）
      app.globalData.userInfo = userInfo;
      app.globalData.userRole = role;
      app.globalData.currentUser = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('userRole', role);
      wx.setStorageSync('currentUser', userInfo);
      
      // 根据角色更新 TabBar
      app.updateTabBarByRole(role);
      
      console.log('登录成功:', userInfo);
      
      // 登录成功，跳转到对应页面
      this.navigateToPage(role);
      
      // 首次管理员提示
      if (result.isNewUser && role === 'admin') {
        wx.showToast({ title: '🎉 您已成为首位管理员', icon: 'none', duration: 2000 });
      }
      
    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 根据角色导航到对应页面
  navigateToPage(role) {
    const roleRoutes = {
      orderer: '/pages/index/index',
      admin: '/pages/index/index',
      sorter: '/pages/outbound/outbound',
      warehouse: '/pages/outbound/outbound'
    };
    
    const route = roleRoutes[role] || '/pages/index/index';
    
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });
    
    setTimeout(() => {
      if (route.includes('/pages/index')) {
        wx.switchTab({ url: route });
      } else {
        wx.redirectTo({ url: route });
      }
    }, 1500);
  }
});
