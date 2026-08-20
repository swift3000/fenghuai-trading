#!/usr/bin/env node
/**
 * 多层级页面深度巡检（T20，对应 AGENTS.md【子页面探测结果】L2/L3）
 * ---------------------------------------------------------------
 * L1（14 页导航）已由 wx-pagewalk-test.js 覆盖；本脚本补：
 *   L2 页内 tab：逐个点击切换 + 断言 data 变化 + 切回
 *   L3 弹窗/表单：setData 打开 + 断言显示 + 关闭 + 断言不残留
 * 纯 UI 操作（setData / 页面自身方法），不写云端、不造数据，无 QA 钩子也可跑。
 * 踩坑继承 pagewalk：evaluate 回调必须自包含；按 route 找页 + 重试；导航后等渲染。
 * 运行：node tests/wx-deepwalk-test.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT = path.resolve(__dirname, '..');
const AUTOMATOR_LIB =
  process.env.WX_AUTOMATOR_LIB ||
  path.join(os.homedir(), '.codex', 'skills', 'wechat-devtools-automator', 'scripts', 'lib');
const { launchSession } = require(path.join(AUTOMATOR_LIB, 'devtools_client.js'));
const { delay } = require(path.join(AUTOMATOR_LIB, 'common.js'));

// 导航目标：route -> {method, url}
const NAV = {
  'pages/orders/orders': { m: 'switchTab', u: '/pages/orders/orders' },
  'pages/new-order/new-order': { m: 'navigateTo', u: '/pages/new-order/new-order' },
  'pages/products/products': { m: 'navigateTo', u: '/pages/products/products' },
  'pages/customers/customers': { m: 'navigateTo', u: '/pages/customers/customers' },
  'pages/receivable/receivable': { m: 'switchTab', u: '/pages/receivable/receivable' },
  'pages/outbound/outbound': { m: 'switchTab', u: '/pages/outbound/outbound' },
  'pages/reports/reports': { m: 'navigateTo', u: '/pages/reports/reports' },
  'pages/order-detail/order-detail': null, // 需要 orderId，单独处理
  'pages/members/members': { m: 'navigateTo', u: '/pages/members/members' },
};

// L2 tab 用例：route, 方法名, 参数(序列化为字符串传页面方法), 切后断言的 data 字段/值, 切回参数
const TAB_CASES = [
  { route: 'pages/orders/orders', label: 'orders.time-tabs', method: 'switchTab', to: { key: 'week' }, assert: (d) => d.timeTab === 'week', back: { key: 'all' }, backAssert: (d) => d.timeTab === 'all' },
  { route: 'pages/receivable/receivable', label: 'receivable.recv-view-tabs', method: 'switchView', to: { tab: 'unpaid' }, assert: (d) => d.viewTab === 'unpaid', back: { tab: 'ledger' }, backAssert: (d) => d.viewTab === 'ledger' },
  { route: 'pages/outbound/outbound', label: 'outbound.sub-tabs(sort->out)', method: 'switchSub', to: { tab: 'out' }, assert: (d) => d.subTab === 'out', back: { tab: 'sort' }, backAssert: (d) => d.subTab === 'sort' },
  { route: 'pages/outbound/outbound', label: 'outbound.export-time-tabs', method: 'switchExportTime', to: { key: 'week' }, assert: (d) => d.exportTimeTab === 'week', back: { key: 'today' }, backAssert: (d) => d.exportTimeTab === 'today' },
  { route: 'pages/reports/reports', label: 'reports.report-tabs', method: 'switchTab', to: { tab: 'customer' }, assert: (d) => d.reportTab === 'customer', back: { tab: 'product' }, backAssert: (d) => d.reportTab === 'product' },
  { route: 'pages/reports/reports', label: 'reports.time-tabs', method: 'switchTime', to: { key: 'month' }, assert: (d) => d.timeTab === 'month', back: { key: 'day' }, backAssert: (d) => d.timeTab === 'day' },
];

// L3 弹窗用例：route, 打开(setData 补丁), 断言键, 关闭方法(调用) 或 关闭补丁
const MODAL_CASES = [
  { route: 'pages/new-order/new-order', label: 'new-order.客户选择', open: { showCustomerModal: true }, key: 'showCustomerModal', close: 'closeCustomerModal' },
  { route: 'pages/new-order/new-order', label: 'new-order.商品选择', open: { showProductModal: true }, key: 'showProductModal', close: 'closeProductModal' },
  { route: 'pages/new-order/new-order', label: 'new-order.智能录入', open: { showSmartModal: true }, key: 'showSmartModal', close: 'closeSmartModal' },
  { route: 'pages/products/products', label: 'products.新增商品表单', open: { showForm: true }, key: 'showForm', close: 'closeForm' },
  { route: 'pages/customers/customers', label: 'customers.新增客户表单', open: { showForm: true }, key: 'showForm', close: 'closeForm' },
  { route: 'pages/order-detail/order-detail', label: 'order-detail.收款弹窗', open: { showCollectModal: true }, key: 'showCollectModal', close: 'closeCollectModal' },
  { route: 'pages/members/members', label: 'members.添加成员弹窗', open: { showMemberForm: true }, key: 'showMemberForm', close: 'closeMemberForm' },
];

async function navTo(s, spec, retries = 3) {
  for (let i = 0; i < retries; i++) {
    await s.evaluate((m, u) => new Promise((res) => {
      try { wx[m]({ url: u, fail: () => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); }
    }), spec.m, spec.u);
    await delay(2500);
    const cur = await s.currentPage();
    if (cur.path === spec.u.split('?')[0].replace(/^\//, '')) return true;
  }
  return false;
}

async function findPage(s, route, waitMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < waitMs) {
    const ok = await s.evaluate((r) => {
      const p = getCurrentPages().find((x) => x.route === r);
      return !!(p && p.data);
    }, route);
    if (ok) return true;
    await delay(1200);
  }
  return false;
}

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

(async () => {
  const session = await launchSession({ projectPath: PROJECT, trustProject: true, timeoutMs: 90000 });
  await delay(5000);
  // cloud init + 登录自举（同 perm-ui：storage + globalData）
  try { await session.evaluate(async () => { try { if (!wx.cloud.config) { wx.cloud.init({ env: 'cloud1-d6g75loi673b1e039' }); } } catch (e) {} return 'ok'; }); await delay(1500); } catch (e) { }
  await session.evaluate(() => new Promise((r) => {
    try {
      const u = { openid: 'qa_deepwalk_admin', name: '测试', role: 'admin', tenantName: '丰淮商贸', permissions: ['order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export', 'product:view', 'product:edit', 'customer:view', 'customer:edit', 'sort:task', 'warehouse:confirm', 'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount', 'report:view', 'report:export', 'report:ledger', 'member:manage'] };
      wx.setStorageSync('currentUser', u); wx.setStorageSync('userInfo', u); wx.setStorageSync('userRole', 'admin');
      try { const app = getApp(); if (app) { app.globalData.userInfo = u; app.globalData.userRole = 'admin'; } } catch (e) { }
      wx.reLaunch({ url: '/pages/index/index' }); r('ok');
    } catch (e) { r('THROW ' + e.message); }
  }));
  await delay(3500);

  // 取一个真实 orderId 供 order-detail 用（读 storage 缓存失败则跳过该页弹窗）
  let orderUrl = null;
  try {
    const oid = await session.evaluate(() => {
      try { const app = getApp(); const d = app && app.globalData && app.globalData.latestOrderId; if (d) return d; } catch (e) { }
      return null;
    });
    if (!oid) {
      // 从 orders 页数据取
      const nav = NAV['pages/orders/orders'];
      if (await navTo(session, nav) && await findPage(session, 'pages/orders/orders')) {
        const first = await session.evaluate(() => { const p = getCurrentPages().find((x) => x.route === 'pages/orders/orders'); const l = p && (p.data.list || p.data.orders || []); return l && l.length ? (l[0].id || l[0]._id) : null; });
        if (first) orderUrl = '/pages/order-detail/order-detail?id=' + first;
      }
    } else orderUrl = '/pages/order-detail/order-detail?id=' + oid;
  } catch (e) { console.log('  ℹ 取 orderId 失败，order-detail 弹窗跳过：' + e.message); }

  // ===== L2 页内 tab =====
  console.log('\n【L2】页内 tab 逐个切换');
  let lastRoute = null;
  for (const tc of TAB_CASES) {
    if (tc.route !== lastRoute) {
      lastRoute = tc.route;
      const okNav = await navTo(session, NAV[tc.route]);
      if (!okNav) { ok(false, tc.label + ' 导航失败'); continue; }
      if (!(await findPage(session, tc.route))) { ok(false, tc.label + ' 页未就绪'); continue; }
    }
    // 切换
    const r1 = await session.evaluate((r, m, ds) => {
      try { const p = getCurrentPages().find((x) => x.route === r); if (!p) return 'NOPAGE'; if (typeof p[m] !== 'function') return 'NOMETHOD'; p[m]({ currentTarget: { dataset: ds } }); return 'ok'; }
      catch (e) { return 'ERR:' + e.message; }
    }, tc.route, tc.method, tc.to);
    await delay(1500);
    const d1 = await session.evaluate((r) => { const p = getCurrentPages().find((x) => x.route === r); return p ? p.data : {}; }, tc.route).catch(() => ({}));
    ok(r1 === 'ok' && tc.assert(d1), tc.label + ' 切到目标态（' + r1 + '）');
    // 切回
    const r2 = await session.evaluate((r, m, ds) => {
      try { const p = getCurrentPages().find((x) => x.route === r); if (!p) return 'NOPAGE'; p[m]({ currentTarget: { dataset: ds } }); return 'ok'; } catch (e) { return 'ERR:' + e.message; }
    }, tc.route, tc.method, tc.back);
    await delay(1500);
    const d2 = await session.evaluate((r) => { const p = getCurrentPages().find((x) => x.route === r); return p ? p.data : {}; }, tc.route).catch(() => ({}));
    ok(r2 === 'ok' && tc.backAssert(d2), tc.label + ' 切回默认态（' + r2 + '）');
  }

  // ===== L3 弹窗 =====
  console.log('\n【L3】弹窗 打开/关闭 巡检');
  lastRoute = null;
  for (const mc of MODAL_CASES) {
    if (mc.route === 'pages/order-detail/order-detail') {
      if (!orderUrl) { console.log('  - ' + mc.label + '（跳过：无 orderId）'); continue; }
      if (mc.route !== lastRoute) {
        lastRoute = mc.route;
        const okNav = await session.evaluate((u) => new Promise((res) => { try { wx.navigateTo({ url: u, fail: () => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); } }), orderUrl);
        await delay(2500);
        if (!(await findPage(session, 'pages/order-detail/order-detail'))) { ok(false, mc.label + ' 详情页未就绪'); continue; }
      }
    } else if (mc.route !== lastRoute) {
      lastRoute = mc.route;
      const okNav = await navTo(session, NAV[mc.route]);
      if (!okNav) { ok(false, mc.label + ' 导航失败'); continue; }
      if (!(await findPage(session, mc.route))) { ok(false, mc.label + ' 页未就绪'); continue; }
    }
    // 打开
    const r1 = await session.evaluate((r, patch) => {
      try { const p = getCurrentPages().find((x) => x.route === r); if (!p) return 'NOPAGE'; p.setData(patch); return 'ok'; } catch (e) { return 'ERR:' + e.message; }
    }, mc.route, mc.open);
    await delay(1200);
    const open1 = await session.evaluate((r, k) => { const p = getCurrentPages().find((x) => x.route === r); return p ? p.data[k] : null; }, mc.route, mc.key);
    ok(r1 === 'ok' && open1 === true, mc.label + ' 打开（' + r1 + '）');
    // 关闭（方法调用；无方法则 setData 置 false 兜底）
    const r2 = await session.evaluate((r, m) => {
      try { const p = getCurrentPages().find((x) => x.route === r); if (!p) return 'NOPAGE';
        if (typeof p[m] === 'function') { p[m]({}); return 'ok'; }
        return 'NOMETHOD'; } catch (e) { return 'ERR:' + e.message; }
    }, mc.route, mc.close);
    if (r2 === 'NOMETHOD') {
      await session.evaluate((r, k) => { const p = getCurrentPages().find((x) => x.route === r); p.setData({ [k]: false }); }, mc.route, mc.key);
    }
    await delay(1200);
    const open2 = await session.evaluate((r, k) => { const p = getCurrentPages().find((x) => x.route === r); return p ? p.data[k] : null; }, mc.route, mc.key);
    ok(open2 === false, mc.label + ' 关闭不残留（' + r2 + '）');
  }

  console.log('\n==== 结果：通过 ' + pass + '，失败 ' + fail + ' ====');
  await session.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });
