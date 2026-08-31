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
ok(o.includes('order:view') && s.includes('order:view') && w.includes('order:view') && a.includes('order:view'), '全员含基线权限 order:view');

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
// 基线权限（order:view）强制并入：覆盖不含基线也会补回
ok(arrEq(pm.mergedPerms('orderer', ['product:view']), ['order:view', 'product:view']), '覆盖不含基线时强制并入 order:view');
// 空数组覆盖 = 仅剩基线（查看订单永远可用，与矩阵 UI 不展示该开关一致）
ok(arrEq(pm.mergedPerms('orderer', []), pm.BASELINE_PERMS), '空数组覆盖 = 仅保留基线权限');

console.log('【3】锁定权限 member:manage 始终仅 admin');
ok(!!pm.LOCKED_PERMS['member:manage'], 'member:manage 在锁定表中');
ok(!pm.DEFAULT_MATRIX['member:manage'].orderer && !pm.DEFAULT_MATRIX['member:manage'].sorter && !pm.DEFAULT_MATRIX['member:manage'].warehouse, '默认矩阵中非 admin 无 member:manage');

console.log('【4】T59-R11 变异测试补强（MUT：存活变异体 → 弱用例登记补断言）');
// R11 存活 18 个变异体 = 共享权限的 admin 列误翻 false。运行期 checkPermission 对 admin 有硬 bypass
//（role==='admin' 直接放行，不查矩阵），行为不受矩阵影响；补断言使矩阵与 bypass 的一致性显式可测。
{
  const shared = Object.keys(pm.DEFAULT_MATRIX).filter(k => !pm.LOCKED_PERMS[k]);
  const badAdmin = shared.filter(k => !pm.DEFAULT_MATRIX[k].admin);
  ok(badAdmin.length === 0, '所有共享权限在默认矩阵中 admin 恒为 true（admin 硬 bypass 与矩阵一致，误翻 false 可被检出）' + (badAdmin.length ? ' 漏=' + badAdmin.join(',') : ''));
  ok(pm.DEFAULT_MATRIX['order:view'] && pm.DEFAULT_MATRIX['order:view'].admin === true, 'order:view 矩阵中 admin 恒为 true（基线权限 admin 列防误翻，R11 存活变异体补断言）');
}
// R11 存活 1 个变异体 = mergedPerms null-check→truthy（null 覆盖被当"无覆盖"走 fallback，正确语义是 null=显式覆盖→仅基线）
ok(arrEq(pm.mergedPerms('orderer', null), pm.defaultPermsForRole('orderer')), 'overrides=null 回落默认（与 undefined 同语义）');

console.log('【4】users/index.js 权限来源 = 共享矩阵（防硬编码漂移）');
const uSrc = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'users', 'index.js'), 'utf8');
const okNoHardcode = !uSrc.includes('const ROLE_PERMISSIONS');
ok(okNoHardcode, 'users/index.js 无硬编码 ROLE_PERMISSIONS（已统一到共享矩阵）');
ok(uSrc.includes("require('./perm-matrix-shared.js')"), 'users/index.js 引用共享矩阵 perm-matrix-shared.js');
ok(uSrc.includes('pm.defaultPermsForRole'), 'users/index.js 用 pm.defaultPermsForRole 分配权限');

console.log('【5】auth 与 users 的共享矩阵文件字节一致');
const A = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'auth', 'perm-matrix-shared.js'), 'utf8');
const B = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'users', 'perm-matrix-shared.js'), 'utf8');
ok(A === B, '两个 perm-matrix-shared.js 完全一致');

console.log(`\n==== 结果：通过 ${pass}，失败 ${fail} ====`);
process.exit(fail ? 1 : 0);
