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
  'pages/shipping/shipping': ['order:print'],
  'pages/reports/reports': ['report:view'],
  'pages/members/members': ['member:manage'],
  'pages/settings/settings': ['member:manage'],
  'pages/profile/profile': []
}

/**
 * 检查页面访问权限
 */
function checkPageAccess(pagePath) {
  
  // 检查是否已登录
  if (!app.globalData.userInfo || !app.globalData.userRole) {
    return {
      allowed: false,
      message: '请先登录',
      redirect: '/pages/login/login'
    }
  }

  const requiredPermissions = PAGE_PERMISSIONS[pagePath] || []
  
  // 如果没有权限要求，直接允许
  if (requiredPermissions.length === 0) {
    return { allowed: true }
  }

  // 检查权限 - 使用角色直接判断
  const role = app.globalData.userRole
  const userPermissions = app.globalData.userInfo.permissions || []


  // 管理员拥有所有权限
  if (role === 'admin') {
    return { allowed: true }
  }

  // 检查是否有所需权限（任一即可，匹配原型 outbound=sort:task||warehouse:confirm）
  const hasPermission = requiredPermissions.some(p => userPermissions.includes(p))

  if (!hasPermission) {
    return {
      allowed: false,
      message: '无权访问此页面',
      redirect: '/pages/index/index'
    }
  }

  return { allowed: true }
}

/**
 * 在页面 onLoad 时调用
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

module.exports = {
  checkPageAccess,
  guardPageLoad,
  PAGE_PERMISSIONS
}
