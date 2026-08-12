const app = getApp();

Page({
  data: {
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
    todayOrdersList: []
  },

  onLoad() {
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
        todayOrders: data.count || 0,
        todayAmount: (data.amount || 0).toFixed(2)
      });
    } catch (error) {
      console.error('加载今日统计失败:', error);
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
          itemCount: (order.items || []).length,
          status: order.status || 'submitted',
          statusText: statusMap[order.status] || '待分拣'
        };
      });
      this.setData({
        todayOrdersList: list
      });
    } catch (error) {
      console.error('加载今日订单失败:', error);
    }
  },

  // 跳转到新建订单
  goToNewOrder() {
    wx.navigateTo({ url: '/pages/new-order/new-order' });
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

  // 跳转到订单列表
  goToOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  // 跳转到智能录入（复用新建订单页的智能录入弹窗）
  goToSmartInput() {
    wx.navigateTo({ url: '/pages/new-order/new-order?smart=1' });
  },

  // 跳转到订单详情
  goToOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/order-detail/order-detail?id=${id}`
      });
    }
  }
});
