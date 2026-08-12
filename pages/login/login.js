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

  // 检查是否是首位管理员
  checkFirstAdmin() {
    const users = app.globalData.users || [];
    const isAdminExists = users.some(u => u.role === 'admin');
    
    // 如果没有任何用户，说明是首次启动，当前选择的角色将成为管理员
    if (users.length === 0) {
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

  // 处理登录
  async handleLogin() {
    const { selectedRole, loading } = this.data;
    
    if (loading) return;
    
    this.setData({ loading: true });
    
    try {
      // 获取用户信息（演示模式：使用模拟数据）
      const userInfo = {
        name: this.getRoleExampleName(selectedRole),
        phone: '138****0000',
        region: '汉滨区',
        role: selectedRole,
        avatar: this.getRoleAvatar(selectedRole)
      };
      
      // 检查是否是首次登录
      const users = app.globalData.users || [];
      const isFirstLogin = users.length === 0;
      
      // 保存用户信息
      await this.saveUserLogin(userInfo, isFirstLogin);
      
      // 登录成功，跳转到对应页面
      this.navigateToPage(selectedRole);
      
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

  // 根据角色获取头像
  getRoleAvatar(role) {
    const avatars = {
      orderer: '张',
      sorter: '周',
      warehouse: '李',
      admin: '王'
    };
    return avatars[role] || '用';
  },

  // 保存用户登录信息
  async saveUserLogin(userInfo, isFirstLogin) {
    // 保存到全局
    app.globalData.currentUser = userInfo;
    
    // 如果是首次登录，自动成为管理员
    if (isFirstLogin) {
      userInfo.role = 'admin';
      userInfo.isFirstAdmin = true;
      
      const users = app.globalData.users || [];
      users.push(userInfo);
      app.globalData.users = users;
      
      // 保存到本地存储
      wx.setStorageSync('users', users);
      wx.setStorageSync('firstAdmin', true);
    }
    
    // 保存当前用户
    wx.setStorageSync('currentUser', userInfo);
    
    console.log('用户登录成功:', userInfo);
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
