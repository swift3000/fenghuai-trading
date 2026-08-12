const app = getApp();

Page({
  data: {
    isFirstAdmin: false,
    loading: false,
    inviteCode: ''
  },

  onLoad(options) {
    this.checkFirstAdmin();
    // 扫码进入：scene 携带 invite=XXXXXX，自动填入邀请码
    if (options && options.scene) {
      const scene = decodeURIComponent(options.scene)
      const m = scene.match(/invite=([A-Z0-9]+)/)
      if (m && m[1]) {
        this.setData({ inviteCode: m[1] })
        wx.showToast({ title: '已识别邀请码，请登录', icon: 'none' })
      }
    }
  },

  // 邀请码输入
  onInviteInput(e) {
    const code = (e.detail.value || '').trim().toUpperCase()
    this.setData({ inviteCode: code })
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
      const params = { action: 'login' }
      // 填写了邀请码则一并提交，由后端完成 openid 绑定与角色激活
      if (this.data.inviteCode) {
        params.inviteCode = this.data.inviteCode
      }
      const result = await callCloud('auth', params);
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
