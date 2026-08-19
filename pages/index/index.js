const app = getApp();

const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    // 用户信息
    userName: '',
    userInitial: '',
    roleName: '',
    roleEmoji: '',
    
    // 日期
    currentDate: '',
    
    // 公告
    announcement: '欢迎使用丰淮商贸采购下单助手',
    
    // 统计数据
    todayOrders: 0,
    todayAmount: 0,
    
    // 今日订单列表
    todayOrdersList: [],

    // 全局搜索
    searchKeyword: '',

    // 第三项统计（按角色：待分拣/待处理/待收款）
    pendingCount: 0,
    pendingLabel: '待处理',

    // 快捷入口权限
    canCreateOrder: false,
    canViewProducts: false,
    canViewCustomers: false,
    canViewReports: false,
    canViewReceivable: false
  },

  onLoad() {
    uiStyle.applyUiStyle(this)
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || [];
    this.setData({
      canCreateOrder: perms.includes('order:create'),
      canViewProducts: perms.includes('product:view'),
      canViewCustomers: perms.includes('customer:view'),
      canViewReports: perms.includes('report:view'),
      canViewReceivable: perms.includes('receivable:view')
    });
    this.loadUserInfo();
    this.loadTodayStats();
    this.loadTodayOrders();
    this.loadCurrentDate();
  },

  // 加载用户信息
  loadUserInfo() {
    const currentUser = app.globalData.currentUser || wx.getStorageSync('currentUser') || {};
    const role = currentUser.role || 'orderer';
    
    const roleMap = {
      orderer: { name: '下单员', emoji: '📝' },
      sorter: { name: '分拣员', emoji: '🔍' },
      warehouse: { name: '库管', emoji: '📦' },
      admin: { name: '管理员', emoji: '👑' }
    };
    
    const roleInfo = roleMap[role] || roleMap.orderer;
    const userName = currentUser.name || '用户';
    const userInitial = userName.charAt(0);
    
    this.setData({
      userName,
      userInitial,
      roleName: roleInfo.name,
      roleEmoji: roleInfo.emoji
    });
  },

  // 加载当前日期
  loadCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[now.getDay()];
    
    this.setData({
      currentDate: `${year}年${month}月${day}日 ${weekDay}`
    });
  },

  // 加载今日统计
  async loadTodayStats() {
    try {
      const { callCloud } = require('../../utils/request');
      const data = await callCloud('orders', { action: 'todayStats' });
      this.setData({
        todayOrders: (data && data.count) || 0,
        todayAmount: ((data && data.amount) || 0).toFixed(2)
      });
    } catch (error) {
      console.error('加载今日统计失败:', error);
      // 失败时设置默认值，避免页面显示异常
      this.setData({
        todayOrders: 0,
        todayAmount: '0.00'
      });
    }
  },

  // 加载今日订单列表
  async loadTodayOrders() {
    try {
      const { callCloud } = require('../../utils/request');
      const orders = await callCloud('orders', { action: 'list', timeTab: 'today' });
      const statusMap = {
        submitted: '待分拣',
        sorted: '已分拣',
        confirmed: '已出库',
        completed: '已完成'
      };
      const list = (orders || []).map(order => {
        const raw = order.created_at || 0;
        const ms = raw && raw.$date ? raw.$date : (raw || Date.now());
        const d = new Date(ms);
        const pad = n => String(n).padStart(2, '0');
        const time = raw ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
        return {
          _id: order._id,
          customerName: order.customerName || '未知客户',
          totalAmount: order.totalAmount || 0,
          time,
          itemCount: (order.items && order.items.length) || 0,
          status: order.status || 'submitted',
          sortStatus: order.sortStatus || 'pending',
          outStatus: order.outStatus || 'pending',
          statusText: statusMap[order.status] || '待分拣'
        };
      });
      this.setData({
        todayOrdersList: list
      });
      this.computePending(orders || []);
    } catch (error) {
      console.error('加载今日订单失败:', error);
      // 失败时设置默认值
      this.setData({
        todayOrdersList: []
      });
    }
  },

  // 按角色计算待处理数量（对齐原型 initHome）
  computePending(orders) {
    const role = (app.globalData.userInfo && app.globalData.userInfo.role) || 'orderer';
    let pending = 0;
    let label = '待处理';
    if (role === 'sorter') {
      pending = orders.filter(o => (o.sortStatus || 'pending') === 'pending').length;
      label = '待分拣';
    } else if (role === 'warehouse') {
      pending = orders.filter(o => (o.outStatus || 'pending') === 'pending').length;
      label = '待出库';
    } else if (role === 'admin') {
      pending = orders.filter(o => (o.sortStatus || 'pending') === 'pending' || (o.outStatus || 'pending') === 'pending').length;
      label = '待处理';
    } else {
      pending = orders.filter(o => (o.paymentStatus || o.payment_status) === 'unpaid').length;
      label = '待收款';
    }
    this.setData({ pendingCount: pending, pendingLabel: label });
  },

  // 全局搜索输入
  onGlobalSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value || '' });
  },

  // 全局搜索：订单页是 Tab 页，无法带参 navigateTo；用全局变量传关键词后 switchTab
  goGlobalSearch() {
    const kw = (this.data.searchKeyword || '').trim();
    app.globalData.pendingOrderSearch = kw;
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  // 工作台：按角色进入对应作业页
  goToWorkbench() {
    const role = (app.globalData.userInfo && app.globalData.userInfo.role) || 'orderer';
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || [];
    if (role === 'sorter' && perms.includes('sort:task')) {
      wx.switchTab({ url: '/pages/outbound/outbound' });
    } else if (role === 'warehouse' && perms.includes('warehouse:confirm')) {
      wx.switchTab({ url: '/pages/outbound/outbound' });
    } else if (perms.includes('receivable:view')) {
      wx.switchTab({ url: '/pages/receivable/receivable' });
    } else {
      wx.switchTab({ url: '/pages/orders/orders' });
    }
  },

  // 跳转到新建订单
  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' });
  },

  // 智能录入悬浮球：进入新建订单并自动弹出智能录入
  goToSmartInput() {
    wx.navigateTo({ url: '/pages/new-order/new-order?smart=1' });
  },

  // 跳转到赊销看板
  goToReceivable() {
    wx.switchTab({ url: '/pages/receivable/receivable' });
  },

  // 跳转到商品管理
  goToProducts() {
    wx.navigateTo({ url: '/pages/products/products' });
  },

  // 跳转到客户管理
  goToCustomers() {
    wx.navigateTo({ url: '/pages/customers/customers' });
  },

  // 跳转到报表
  goToReports() {
    wx.navigateTo({ url: '/pages/reports/reports' });
  },

  // 跳转到订单列表（Tab 页）
  goToOrders() {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  // 跳转到订单详情
  goToOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/order-detail/order-detail?id=${id}`
      });
    }
  },

  onShow() {
    tabbarHelper.refreshCustomTabBar('home')
  },

  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
});
