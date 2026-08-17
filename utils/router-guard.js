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

  // 检查是否有所需权限（任一即可，匹配原型 outbound=sort:task||warehouse:confirm）
  const hasPermission = requiredPermissions.some(p => userPermissions.includes(p))
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
