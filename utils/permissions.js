/**
 * 权限工具类
 * 提供权限检查、过滤等功能
 */

const app = getApp()

/**
 * 检查当前用户是否拥有指定权限
 * @param {string} permission - 权限 key，如 'order:create', 'member:manage'
 * @returns {boolean} - 是否拥有权限
 */
function checkPermission(permission) {
  if (!app.globalData.userInfo || !app.globalData.userInfo.permissions) {
    return false
  }
  return app.globalData.userInfo.permissions.includes(permission)
}

/**
 * 检查当前用户是否拥有多个权限中的任意一个
 * @param {string[]} permissions - 权限数组
 * @returns {boolean} - 是否拥有任意一个权限
 */
function checkAnyPermission(permissions) {
  if (!app.globalData.userInfo || !app.globalData.userInfo.permissions) {
    return false
  }
  return permissions.some(p => app.globalData.userInfo.permissions.includes(p))
}

/**
 * 检查当前用户是否拥有所有指定权限
 * @param {string[]} permissions - 权限数组
 * @returns {boolean} - 是否拥有所有权限
 */
function checkAllPermissions(permissions) {
  if (!app.globalData.userInfo || !app.globalData.userInfo.permissions) {
    return false
  }
  return permissions.every(p => app.globalData.userInfo.permissions.includes(p))
}

/**
 * 检查当前用户是否为管理员
 * @returns {boolean}
 */
function isAdmin() {
  return app.globalData.userRole === 'admin'
}

/**
 * 检查当前用户是否为下单员
 * @returns {boolean}
 */
function isOrderer() {
  return app.globalData.userRole === 'orderer'
}

/**
 * 检查当前用户是否为分拣员
 * @returns {boolean}
 */
function isSorter() {
  return app.globalData.userRole === 'sorter'
}

/**
 * 检查当前用户是否为库管
 * @returns {boolean}
 */
function isWarehouse() {
  return app.globalData.userRole === 'warehouse'
}

/**
 * 获取当前用户角色名称
 * @returns {string}
 */
function getRoleName() {
  const roleMap = {
    admin: '管理员',
    orderer: '下单员',
    sorter: '分拣员',
    warehouse: '库管'
  }
  return roleMap[app.globalData.userRole] || '未知角色'
}

/**
 * 过滤 TabBar 项目（根据权限显示/隐藏）
 * @param {object[]} tabs - TabBar 项目数组
 * @returns {object[]} - 过滤后的 TabBar 项目
 */
function filterTabs(tabs) {
  return tabs.filter(tab => {
    if (!tab.permission) {
      return true
    }
    return checkPermission(tab.permission)
  })
}

/**
 * 路由守卫 - 检查是否有权访问指定页面
 * @param {string} requiredPermission - 所需权限
 * @returns {boolean} - 是否有权访问
 */
function canAccess(requiredPermission) {
  if (!app.globalData.userInfo) {
    // 未登录，跳转到登录页
    wx.reLaunch({ url: '/pages/login/login' })
    return false
  }
  
  if (!checkPermission(requiredPermission)) {
    wx.showToast({
      title: '无权访问',
      icon: 'none'
    })
    return false
  }
  
  return true
}

/**
 * 显示权限不足提示
 */
function showPermissionDenied() {
  wx.showToast({
    title: '权限不足，请联系管理员',
    icon: 'none',
    duration: 2000
  })
}

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  isAdmin,
  isOrderer,
  isSorter,
  isWarehouse,
  getRoleName,
  filterTabs,
  canAccess,
  showPermissionDenied
}
