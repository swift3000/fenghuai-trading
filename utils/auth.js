/**
 * 权限校验工具
 */
const app = getApp()

function getUserRole() {
  return app.globalData.userRole || wx.getStorageSync('userRole')
}

function checkPermission(permissionKey) {
  const role = getUserRole()
  if (!role) return false
  if (role === 'admin') return true
  const permissions = {
    orderer: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit', 'customer:view', 'customer:edit',
      'sort:task', 'receivable:view', 'receivable:collect', 'receivable:discount',
      'report:view', 'report:export', 'report:ledger'
    ],
    sorter: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit', 'customer:view', 'customer:edit',
      'sort:task', 'receivable:view', 'receivable:collect', 'receivable:discount',
      'report:view', 'report:export', 'report:ledger'
    ],
    warehouse: [
      'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export',
      'product:view', 'product:edit', 'customer:view', 'customer:edit',
      'sort:task', 'warehouse:confirm', 'receivable:view', 'receivable:confirm', 'receivable:discount',
      'report:view', 'report:export', 'report:ledger'
    ]
  }
  return (permissions[role] || []).includes(permissionKey)
}

module.exports = { getUserRole, checkPermission }
