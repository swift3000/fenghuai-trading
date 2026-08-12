const app = getApp();

Page({
  data: {
    selectedRole: 'orderer', // 默认选择下单员
    isFirstAdmin: false,
    loading: false,
    roleProfiles: {
      orderer: {
        name: '下单员',
        icon: '📝',
        example: '张经理',
        desc: '负责创建和管理订单'
      },
      sorter: {
        name: '分拣员',
        icon: '🔍',
        example: '周分拣',
        desc: '负责订单分拣作业'
      },
      warehouse: {
        name: '库管',
        icon: '📦',
        example: '李库管',
        desc: '负责出库确认和件型管理'
      },
      admin: {
        name: '管理员',
        icon: '👑',
        example: '王老板',
        desc: '拥有全部管理权限'
      }
    }
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

  // 选择角色
  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    if (role && role !== this.data.selectedRole) {
      this.setData({ selectedRole: role });
    }
  },

  // 处理登录（对接 auth 云函数，换取真实 openid）
  async handleLogin() {
    const { selectedRole, loading } = this.data;
    
    if (loading) return;
    
    this.setData({ loading: true });
    
    try {
      const { callCloud } = require('../../utils/request');
      // 调用 auth/login：微信云函数内自动取 OPENID，实现真实身份登录
      const result = await callCloud('auth', {
        action: 'login',
        role: selectedRole,
        name: this.getRoleExampleName(selectedRole),
        region: '汉滨区'
      });
      const userInfo = result.userInfo || {};
      
      // 首位管理员：后端已按“首个 admin 自动设管理员”规则返回，这里同步角色
      const role = userInfo.role || selectedRole;
      
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

  // 根据角色获取示例姓名
  getRoleExampleName(role) {
    const names = {
      orderer: '张经理',
      sorter: '周分拣',
      warehouse: '李库管',
      admin: '王老板'
    };
    return names[role] || '用户';
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
