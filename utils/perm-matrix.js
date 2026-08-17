/**
 * 角色权限矩阵工具（对齐原型 1.0「角色权限配置」）
 *
 * 权限矩阵 = 权限 × 角色的二维开关配置。管理员可在「成员管理-权限配置」逐项开关，
 * 改动即时保存（存 perm_configs 集合），登录/门禁按覆盖后的实际权限生效。
 * 默认「全员开放」：仅赊销登记/确认两步分离 + 成员管理管理员独占（防锁死）。
 *
 * 每个权限键在各角色下的布尔值即「该角色.该权限」开关。
 */

// 权限分组（按模块分组，供成员管理-权限配置 UI 渲染）
const PERM_GROUPS = [
  { name: '订单管理', keys: ['order:create', 'order:edit', 'order:delete', 'order:print', 'order:export'] }, // 查看订单为全员基础权限（BASELINE_PERMS），不出现在开关矩阵
  { name: '商品管理', keys: ['product:view', 'product:edit'] },
  { name: '客户管理', keys: ['customer:view', 'customer:edit'] },
  { name: '分拣作业', keys: ['sort:task'] },
  { name: '库管出库', keys: ['warehouse:confirm'] },
  { name: '赊销收款', keys: ['receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount'] },
  { name: '报表中心', keys: ['report:view', 'report:export', 'report:ledger'] },
  { name: '系统管理', keys: ['member:manage'] }
]

// 权限中文标签
const PERM_LABELS = {
  'order:view': '查看订单', 'order:create': '新建订单', 'order:edit': '编辑订单', 'order:delete': '删除订单',
  'order:print': '打印/转发', 'order:export': '导出订单',
  'product:view': '查看商品', 'product:edit': '商品维护(增改删)',
  'customer:view': '查看客户', 'customer:edit': '客户维护(增改删)',
  'sort:task': '处理分拣',
  'warehouse:confirm': '出库确认',
  'receivable:view': '查看赊销看板', 'receivable:collect': '登记收款',
  'receivable:confirm': '确认收款', 'receivable:discount': '折价/减免',
  'report:view': '查看报表', 'report:export': '导出报表', 'report:ledger': '收款台账',
  'member:manage': '成员管理'
}

// 权限锁定项：不可被管理员关闭（防锁死）
const PERM_LOCKED = { 'member:manage': true }

// 角色顺序（矩阵表头 / 前端渲染用）
const ROLE_ORDER = ['orderer', 'sorter', 'warehouse', 'admin']
const ROLE_LABELS = { admin: '管理员', orderer: '下单员', sorter: '分拣员', warehouse: '库管' }

// 各角色默认权限矩阵（对齐原型 DEFAULT_ROLE_PERMISSIONS）
// 默认「全员开放」：仅赊销两步分离 + 成员管理管理员独占
const DEFAULT_MATRIX = {
  'order:view':         { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'order:create':       { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'order:edit':         { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'order:delete':       { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'order:print':        { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'order:export':       { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'product:view':       { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'product:edit':       { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'customer:view':      { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'customer:edit':      { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'sort:task':          { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'warehouse:confirm':  { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'receivable:view':    { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'receivable:collect': { orderer: true,  sorter: true,  warehouse: false, admin: true },
  'receivable:confirm': { orderer: false, sorter: false, warehouse: true,  admin: true },
  'receivable:discount':{ orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'report:view':        { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'report:export':      { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'report:ledger':      { orderer: true,  sorter: true,  warehouse: true,  admin: true },
  'member:manage':      { orderer: false, sorter: false, warehouse: false, admin: true }
}

// 按角色取默认权限（权限键数组）
function defaultPermsForRole(role) {
  const list = []
  PERM_GROUPS.forEach(g => g.keys.forEach(key => {
    if (DEFAULT_MATRIX[key] && DEFAULT_MATRIX[key][role]) list.push(key)
  }))
  return list
}

// 权重排序：admin > orderer > sorter > warehouse
const ROLE_WEIGHT = { admin: 0, orderer: 1, sorter: 2, warehouse: 3 }
function sortRoles(roles) {
  return roles.slice().sort((a, b) => (ROLE_WEIGHT[a] || 9) - (ROLE_WEIGHT[b] || 9))
}

module.exports = {
  PERM_GROUPS,
  PERM_LABELS,
  PERM_LOCKED,
  ROLE_ORDER,
  ROLE_LABELS,
  DEFAULT_MATRIX,
  defaultPermsForRole,
  sortRoles
}
