#!/usr/bin/env node
/**
 * 角色权限逻辑测试（纯 Node，不依赖模拟器）
 * 覆盖：各角色默认权限、merge/锁定、users/index.js 硬编码表与矩阵一致性
 */
const fs = require('fs');
const path = require('path');
const pm = require(path.join(__dirname, '..', 'cloudfunctions', 'auth', 'perm-matrix-shared.js'));

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function arrEq(a, b) { return a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(','); }

console.log('【1】各角色默认权限（赊销两步分离 + 成员管理独占）');
const o = pm.defaultPermsForRole('orderer');
const s = pm.defaultPermsForRole('sorter');
const w = pm.defaultPermsForRole('warehouse');
const a = pm.defaultPermsForRole('admin');
ok(o.includes('receivable:collect') && !o.includes('receivable:confirm'), '下单员：可登记收款、不可确认收款');
ok(s.includes('receivable:collect') && !s.includes('receivable:confirm'), '分拣员：可登记收款、不可确认收款');
ok(w.includes('receivable:confirm') && !w.includes('receivable:collect'), '库管：可确认收款、不可登记收款');
ok(a.includes('receivable:collect') && a.includes('receivable:confirm'), '管理员：登记+确认收款都有');
ok(o.includes('member:manage') === false && w.includes('member:manage') === false && s.includes('member:manage') === false, '成员管理仅管理员');
ok(a.includes('member:manage'), '管理员拥有 member:manage');
ok(o.length === s.length && o.length === w.length, '下单员/分拣员/库管 非赊销权限数量一致');

console.log('【2】mergedPerms：覆盖 / 回落 / 非法键过滤');
const baseO = pm.defaultPermsForRole('orderer');
// 无覆盖 -> 回落默认
ok(arrEq(pm.mergedPerms('orderer', undefined), baseO), '无覆盖时回落默认');
// 有覆盖 -> 采用覆盖数组
const ov = ['order:view', 'product:view'];
ok(arrEq(pm.mergedPerms('orderer', ov), ov), '有覆盖时直接采用覆盖数组');
// 空串/非字符串被过滤（合法写入路径 save-perm 已按白名单校验，此处仅防垃圾数据）
const ovBad = ['order:view', '', 'x'];
ok(arrEq(pm.mergedPerms('orderer', ovBad), ['order:view', 'x']), '空串被过滤，非空串保留');
console.log('  ℹ 提示: mergedPerms 不做白名单校验；bogus 非空串仅在手动改库时可能出现（正常 UI 写入已由 save-perm 白名单拦截）。可加白名单做纵深防御。');
// 覆盖可为空数组（关闭全部）-> 返回空
ok(arrEq(pm.mergedPerms('orderer', []), []), '空数组覆盖 = 关闭该角色全部权限');

console.log('【3】锁定权限 member:manage 始终仅 admin');
ok(!!pm.LOCKED_PERMS['member:manage'], 'member:manage 在锁定表中');
ok(!pm.DEFAULT_MATRIX['member:manage'].orderer && !pm.DEFAULT_MATRIX['member:manage'].sorter && !pm.DEFAULT_MATRIX['member:manage'].warehouse, '默认矩阵中非 admin 无 member:manage');

console.log('【4】users/index.js 硬编码 ROLE_PERMISSIONS 与矩阵一致性（防漂移 bug）');
const uSrc = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'users', 'index.js'), 'utf8');
const start = uSrc.indexOf('const ROLE_PERMISSIONS = {');
let depth = 0, end = -1;
for (let i = uSrc.indexOf('{', start); i < uSrc.length; i++) {
  if (uSrc[i] === '{') depth++;
  else if (uSrc[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const ROLE_PERMISSIONS = eval('(' + uSrc.slice(start + 'const ROLE_PERMISSIONS ='.length, end) + ')');
for (const role of ['admin', 'orderer', 'sorter', 'warehouse']) {
  ok(arrEq(ROLE_PERMISSIONS[role] || [], pm.defaultPermsForRole(role)), `ROLE_PERMISSIONS.${role} === 矩阵默认（${(ROLE_PERMISSIONS[role]||[]).length} 项）`);
}

console.log('【5】auth 与 users 的共享矩阵文件字节一致');
const A = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'auth', 'perm-matrix-shared.js'), 'utf8');
const B = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'users', 'perm-matrix-shared.js'), 'utf8');
ok(A === B, '两个 perm-matrix-shared.js 完全一致');

console.log(`\n==== 结果：通过 ${pass}，失败 ${fail} ====`);
process.exit(fail ? 1 : 0);
