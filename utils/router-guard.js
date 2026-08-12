/**
 * 路由守卫工具
 * 用于检查页面访问权限和角色路由
 */

const app = getApp()

// 页面权限配置：页面路径 -> 所需权限
const PAGE_PERMISSIONS = {
  'pages/index/index': ['order:view', 'order:create'],
  'pages/orders/orders': ['order:view'],
  'pages/new-order/new-order': ['order:create'],
  'pages/order-detail/order-detail': ['order:view'],
  'pages/products/products': ['product:view'],
  'pages/customers/customers': ['customer:view'],
  'pages/receivable/receivable': ['receivable:view'],
  'pages/outbound/outbound': ['warehouse:confirm', 'sort:task'],
  'pages/shipping/shipping': ['sort:task', 'warehouse:confirm'],
  'pages/reports/reports': ['report:view'],
  'pages/members/members': ['member:manage'],
  'pages/settings/settings': ['permission:manage'],
  'pages/profile/profile': [] // 所有人都可以访问
}

// 角色对应的 TabBar 配置
const ROLE_TABBAR = {
  admin: [0, 1, 2, 3, 4], // 首页、订单、赊销、分拣出库、我的
  orderer: [0, 1, 4],     // 首页、订单、我的
  sorter: [0, 3, 4],      // 首页、分拣出库、我的
  warehouse: [0, 3, 4]    // 首页、分拣出库、我的
}

/**
 * 检查页面访问权限
 * @param {string} pagePath - 页面路径
 * @returns {object} { allowed: boolean, message: string }
 */
function checkPageAccess(pagePath) {
  console.log('[路由守卫] 检查页面访问:', pagePath)
  console.log('[路由守卫] 全局用户信息:', app.globalData.userInfo)
  console.log('[路由守卫] 全局用户角色:', app.globalData.userRole)
  
  // 检查是否已登录
  if (!app.globalData.userInfo || !app.globalData.userRole) {
    console.log('[路由守卫] 未登录，拒绝访问')
    return {
      allowed: false,
      message: '请先登录',
      redirect: '/pages/login/login'
    }
  }

  const requiredPermissions = PAGE_PERMISSIONS[pagePath] || []
  
  // 如果没有权限要求，直接允许
  if (requiredPermissions.length === 0) {
    console.log('[路由守卫] 无权限要求，允许访问')
    return { allowed: true }
  }

  // 检查权限 - 使用角色直接判断
  const role = app.globalData.userRole
  const userPermissions = app.globalData.userInfo.permissions || []
  
  console.log('[路由守卫] 用户角色:', role)
  console.log('[路由守卫] 用户权限:', userPermissions)
  console.log('[路由守卫] 需要权限:', requiredPermissions[0])
  
  // 管理员拥有所有权限
  if (role === 'admin') {
    console.log('[路由守卫] 管理员，允许访问')
    return { allowed: true }
  }
  
  // 检查是否有所需权限
  const hasPermission = userPermissions.includes(requiredPermissions[0])
  console.log('[路由守卫] 权限检查结果:', hasPermission)
  
  if (!hasPermission) {
    return {
      allowed: false,
      message: '无权访问此页面',
      redirect: '/pages/index/index'
    }
  }

  console.log('[路由守卫] 允许访问')
  return { allowed: true }
}

/**
 * 在页面 onLoad 时调用
 * @param {object} page - 页面实例
 */
function guardPageLoad(page) {
  const pagePath = page.route
  
  const accessResult = checkPageAccess(pagePath)
  if (!accessResult.allowed) {
    wx.showToast({
      title: accessResult.message || '无权访问',
      icon: 'none',
      duration: 2000
    })
    
    if (accessResult.redirect) {
      setTimeout(() => {
        wx.reLaunch({ url: accessResult.redirect })
      }, 2000)
    }
    
    return false
  }
  
  return true
}

/**
 * 获取当前角色可访问的 TabBar 索引
 * @param {string} role - 用户角色
 * @returns {number[]} TabBar 索引数组
 */
function getRoleTabBar(role) {
  return ROLE_TABBAR[role] || [0, 4] // 默认只显示首页和我的
}

/**
 * 检查是否可以访问某个 Tab
 * @param {string} role - 用户角色
 * @param {number} tabIndex - Tab 索引
 * @returns {boolean}
 */
function canAccessTab(role, tabIndex) {
  const allowedTabs = getRoleTabBar(role)
  return allowedTabs.includes(tabIndex)
}

module.exports = {
  checkPageAccess,
  guardPageLoad,
  getRoleTabBar,
  canAccessTab,
  PAGE_PERMISSIONS
}
