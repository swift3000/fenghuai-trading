// 共享权限矩阵常量（auth/users 云函数与前端共用）
// ⚠️ 本文件是权限矩阵「单一来源」。utils/perm-matrix.js 的 PERM_GROUPS/DEFAULT_MATRIX 必须与它保持一致；
//    修改后请同步 cloudfunctions/users/perm-matrix-shared.js（逐字节相同，云函数按目录独立部署），
//    并运行 npm run check:perms 校验（部署云函数前建议执行）。
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
// 基线权限：所有角色永久拥有、不可被关闭、不出现在开关矩阵（避免管理员保存其他开关时被全量回写误删）
const BASELINE_PERMS = ['order:view']
// 锁定权限：始终仅 admin，不可被关闭
const LOCKED_PERMS = { 'member:manage': true }
// 收集 role 的所有默认权限 key
function defaultPermsForRole(role) {
  const list = BASELINE_PERMS.slice()
  PERM_GROUPS.forEach(g => g.keys.forEach(key => {
    if (DEFAULT_MATRIX[key] && DEFAULT_MATRIX[key][role]) list.push(key)
  }))
  return Array.from(new Set(list))
}
// 计算角色最终权限：
// perm_configs 存的是该角色「完整权限数组」（save-perm 已写全量,含锁定项保护）。
// 有覆盖记录(overrides != null)则直接采用该数组；无记录(undefined/null)回落默认。
function mergedPerms(role, overrides) {
  if (overrides != null) {
    return Array.from(new Set(BASELINE_PERMS.concat((overrides || []).filter(k => typeof k === 'string' && k.length))))
  }
  return defaultPermsForRole(role)
}
module.exports = {
  BASELINE_PERMS,
  PERM_GROUPS,
  DEFAULT_MATRIX,
  LOCKED_PERMS,
  defaultPermsForRole,
  mergedPerms,
  ROLES: ['admin', 'orderer', 'sorter', 'warehouse']
}
