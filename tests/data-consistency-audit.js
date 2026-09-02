#!/usr/bin/env node
/**
 * T52 全业务数据对账审计（只读，零写入）：
 *  1. 订单总额 vs 明细行金额合计（存量漂移检测）
 *  2. 订单实收 vs payments 已确认记录合计
 *  3. payment_status 与金额一致性（paid⇔欠款为0）
 *  4. 孤儿收款记录（payment 指向不存在订单）
 *  5. 取消/完成订单的收款状态合理性
 *  6. 赊销守恒：逐客户 应收=已收+未结清（独立聚合）
 *  7. 用户权限快照 vs 权限矩阵（perm_configs 覆盖一致性）
 *  8. 数据完整性：客户/商品/区域引用完整性 + 0元订单残留 + 0件0包行
 */
const path = require('path'), fs = require('fs');
const PROJECT = '/Users/god/Desktop/项目/github/fenghuai-trading';
const cb = require(path.join(PROJECT, 'node_modules/@cloudbase/node-sdk'));
const pm = require(path.join(PROJECT, 'cloudfunctions/auth/perm-matrix-shared.js'));
const env = {};
fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
const db = cb.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID }).database();
let pass = 0, fail = 0, warn = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const wr = (c, m) => { if (!c) { warn++; console.log('  ⚠ ' + m); } };
const cents = n => Math.round((Number(n) || 0) * 100);
const asyncMain = async () => {
  // ---- 拉全量数据 ----
  const fetchAll = async (q) => { const all = []; for (let s = 0; ; s += 100) { const b = await q.skip(s).limit(100).get(); all.push(...b.data); if (b.data.length < 100) break; } return all; };
  console.log('[拉取全量数据...]');
  const orders = await fetchAll(db.collection('orders'));
  const payments = await fetchAll(db.collection('payments'));
  const users = await fetchAll(db.collection('users'));
  const customers = await fetchAll(db.collection('customers'));
  const products = await fetchAll(db.collection('products'));
  const regions = await fetchAll(db.collection('regions'));
  const permConfigs = await fetchAll(db.collection('perm_configs'));
  console.log(`  订单 ${orders.length} | 收款 ${payments.length} | 用户 ${users.length} | 客户 ${customers.length} | 商品 ${products.length} | 区域 ${regions.length} | 权限覆盖 ${permConfigs.length}`);
  const orderIds = new Set(orders.map(o => o._id));
  const custIds = new Set(customers.map(c => c._id));
  const prodIds = new Set(products.map(p => p._id));
  const regIds = new Set(regions.map(r => r._id));
  const TEST = o => (o._id || '').startsWith('TEST') || /TEST/.test(o.orderNo || '') || /qa_test/.test(o.customerName || '');
  const realOrders = orders.filter(o => !TEST(o));

  console.log('\n[1] 订单总额 vs 明细行合计（分位精度，容差 1 分）');
  let drift = [];
  for (const o of realOrders) {
    const items = (o.items || []).filter(it => (it.piece_qty || 0) > 0 || (it.package_qty != null ? it.package_qty : (it.zero_qty || 0)) > 0);
    const sum = cents(items.reduce((s, it) => s + (Number(it.amount) || 0), 0));
    const total = cents(o.totalAmount);
    if (Math.abs(sum - total) > 1) drift.push({ no: o.orderNo, total, sum });
  }
  ok(drift.length === 0, drift.length === 0 ? `全部 ${realOrders.length} 单总额与明细一致` : `漂移 ${drift.length} 单: ` + JSON.stringify(drift.slice(0, 5)));

  console.log('\n[2] 订单实收 vs payments 已确认合计');
  const confirmedByOrder = {};
  for (const p of payments) {
    if (p.status !== 'confirmed') continue;
    const oid = p.orderId || p.order_id;
    if (!confirmedByOrder[oid]) confirmedByOrder[oid] = { amt: 0, disc: 0 };
    confirmedByOrder[oid].amt += cents(p.amount);
    confirmedByOrder[oid].disc += cents(p.discount);
  }
  let recvMismatch = [];
  for (const o of realOrders) {
    const cp = confirmedByOrder[o._id];
    const expect = cp ? cp.amt : 0;
    const actual = cents(o.received_amount != null ? o.received_amount : (o.receivedAmount || 0));
    if (Math.abs(actual - expect) > 1) recvMismatch.push({ no: o.orderNo, actual, expect });
  }
  ok(recvMismatch.length === 0, recvMismatch.length === 0 ? '全部订单实收与已确认收款一致' : `不一致 ${recvMismatch.length} 单: ` + JSON.stringify(recvMismatch.slice(0, 5)));

  console.log('\n[3] payment_status 与欠款一致性');
  let psMismatch = [];
  for (const o of realOrders) {
    const cp = confirmedByOrder[o._id] || { amt: 0, disc: 0 };
    const remain = cents(o.totalAmount) - cp.amt - cp.disc;
    const ps = o.payment_status || o.paymentStatus;
    if (ps === 'paid' && remain > 1) psMismatch.push({ no: o.orderNo, ps, remain: Math.round(remain) / 100 });
    if (ps === 'unpaid' && (cp.amt > 0 || cp.disc > 0)) psMismatch.push({ no: o.orderNo, ps: 'unpaid 但有已确认收款', remain: Math.round(remain) / 100 });
  }
  ok(psMismatch.length === 0, psMismatch.length === 0 ? '全部订单收款状态与金额一致' : `不一致 ${psMismatch.length} 单: ` + JSON.stringify(psMismatch.slice(0, 5)));

  console.log('\n[4] 孤儿收款记录');
  const orphans = payments.filter(p => { const oid = p.orderId || p.order_id; return !oid || !orderIds.has(oid); });
  ok(orphans.length === 0, orphans.length === 0 ? '无孤儿收款' : `孤儿 ${orphans.length} 条: ` + JSON.stringify(orphans.slice(0, 3).map(p => ({ id: p._id, oid: p.orderId, status: p.status, amt: p.amount }))));

  console.log('\n[5] 取消/完成订单收款合理性');
  const badTerminal = realOrders.filter(o => (o.status === 'cancelled') && ((confirmedByOrder[o._id] || { amt: 0 }).amt > 0));
  ok(badTerminal.length === 0, badTerminal.length === 0 ? '无"已取消但有确认收款"订单' : `${badTerminal.length} 单: ` + JSON.stringify(badTerminal.map(o => o.orderNo)));

  console.log('\n[6] 赊销守恒：逐客户 应收=已收+未结清（独立聚合，分位）');
  const custAgg = {};
  for (const o of realOrders) {
    const cid = o.customerId;
    if (!cid) continue;
    if (!custAgg[cid]) custAgg[cid] = { total: 0, recv: 0, name: o.customerName };
    const cp = confirmedByOrder[o._id] || { amt: 0, disc: 0 };
    custAgg[cid].total += cents(o.totalAmount);
    custAgg[cid].recv += cp.amt + cp.disc;
  }
  let consv = 0;
  for (const cid of Object.keys(custAgg)) { const a = custAgg[cid]; const unsettled = a.total - a.recv; consv++; if (unsettled < 0) { fail++; console.log('  ✗ 客户 ' + a.name + ' 未结清为负: 应收 ' + a.total / 100 + ' 已收 ' + a.recv / 100); } }
  ok(consv > 0 && fail === 0, `已校验 ${consv} 个客户守恒（未结清均 >= 0）`);

  console.log('\n[7] 用户权限快照 vs 权限矩阵');
  const byRole = {};
  permConfigs.forEach(c => { byRole[c.role] = c.permissions; });
  let permDrift = [];
  for (const u of users) {
    if (u.role === 'admin') continue; // admin 全权
    if (u.status === 'pending') continue; // T62：待激活邀请账号（无 openid）尚无权限快照，登录激活时自动回填（auth 登录流），不属漂移
    const effective = (byRole[u.role] != null) ? byRole[u.role] : (pm.defaultPermsForRole(u.role) || []);
    const mine = u.permissions || [];
    const a = new Set(effective), b = new Set(mine);
    const diff = [...a].filter(x => !b.has(x)).concat([...b].filter(x => !a.has(x)));
    if (diff.length) permDrift.push({ name: u.name, role: u.role, diff });
  }
  ok(permDrift.length === 0, permDrift.length === 0 ? `${users.length} 用户权限快照与矩阵一致` : `漂移 ${permDrift.length} 人: ` + JSON.stringify(permDrift.slice(0, 5)));
  const locked = users.filter(u => u.role !== 'admin' && (u.permissions || []).includes('member:manage'));
  ok(locked.length === 0, 'member:manage 无越权授予');

  console.log('\n[8] 引用完整性与脏数据');
  const badCust = realOrders.filter(o => o.customerId && !custIds.has(o.customerId));
  ok(badCust.length === 0, badCust.length === 0 ? '订单→客户引用完整' : `${badCust.length} 单客户不存在`);
  const badProd = [];
  for (const o of realOrders) (o.items || []).forEach(it => { if (it.product_id && !prodIds.has(it.product_id)) badProd.push(o.orderNo); });
  ok(badProd.length === 0, badProd.length === 0 ? '订单明细→商品引用完整' : `${badProd.length} 行商品不存在: ` + badProd.slice(0, 3).join(','));
  const zeroOrders = realOrders.filter(o => cents(o.totalAmount) <= 0);
  ok(zeroOrders.length === 0, zeroOrders.length === 0 ? '无 0 元订单残留' : `${zeroOrders.length} 个 0 元订单: ` + zeroOrders.map(o => o.orderNo).join(','));
  const custRegBad = customers.filter(c => c.region_id && !regIds.has(c.region_id));
  wr(custRegBad.length === 0, `客户→区域引用: ${custRegBad.length === 0 ? '完整' : custRegBad.length + ' 个客户区域ID悬空'}`);
  const dupSku = {};
  products.forEach(p => { dupSku[p.material_code] = (dupSku[p.material_code] || 0) + 1; });
  const skus = Object.keys(dupSku).filter(k => dupSku[k] > 1);
  ok(skus.length === 0, skus.length === 0 ? `material_code 无重复（${products.length} 个商品）` : `重复 material_code: ` + skus.slice(0, 5).join(','));

  console.log('\n==============================');
  console.log(`T52 数据对账审计结果：通过 ${pass}，失败 ${fail}，警告 ${warn}`);
  console.log(fail === 0 ? '✅ 全量数据对账通过' : '❌ 存在数据问题，需建卡修复');
  process.exit(fail === 0 ? 0 : 1);
};
asyncMain().catch(e => { console.error('审计脚本异常', e); process.exit(2); });
