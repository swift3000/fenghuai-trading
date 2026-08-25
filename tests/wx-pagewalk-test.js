#!/usr/bin/env node
/**
 * 真机逐页实测（可复跑）
 * ---------------------------------------------------------------
 * 登录态就绪后，一键遍历小程序全部页面：导航 -> 等渲染刷新 ->
 * 读关键数据断言 -> 截图留档。
 *
 * 踩坑经验（勿改）：
 *   1. 导航 URL 必须带前导斜杠 /pages/xxx/xxx。
 *   2. 自定义 tabBar 的 tab 页用 switchTab，其余用 navigateTo。
 *   3. 导航后必须等 ~4.2s 再截图，否则 App.captureScreenshot 拿旧帧。
 *   4. 用 App.callFunction 在 App 上下文直接调 wx.xxx（比 callWxMethod 稳）。
 *   5. evaluate 的函数体必须**完全自包含**：不能引用任何外层闭包变量
 *      （函数会被 toString 序列化到小程序端执行，闭包会丢失 -> "xxx is not defined"）；
 *      且只读标量字段，不要序列化整个 data 对象（会挂起）。
 *
 * 运行：node tests/wx-pagewalk-test.js   （或 npm run test:wx-pages）
 * 前提：微信开发者工具已登录、项目可 cli auto 起自动化会话。
 * 退出码：0 全绿；1 有页面失败。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT, '.local', 'output', 'wx-pagewalk-test');
const AUTOMATOR_LIB =
  process.env.WX_AUTOMATOR_LIB ||
  path.join(os.homedir(), '.codex', 'skills', 'wechat-devtools-automator', 'scripts', 'lib');

const { launchSession } = require(path.join(AUTOMATOR_LIB, 'devtools_client.js'));
const { delay, ensureDirFor } = require(path.join(AUTOMATOR_LIB, 'common.js'));

const TEST_PGWK_TAG = 'TEST_PGWK';
let createdTestOrderId = null;
let testDb = null;
// T49: 云端 admin 自举（同 T48 wx-perm-ui / T49 deepwalk 模式）——order-detail/members 探针
// 走真实 callCloud，云侧校验开发者工具【真实】openid；users=0 时 401 → hasOrder=false/members 空。
// 测试前幂等 upsert 临时 admin（node-sdk 顶层字段口径），测后自清理。
const DEVTOOLS_OPENID = 'oo0s93SW9A4V4iO1ANyA3eqzxVIA';
const PGWK_BOOT_NAME = 'QA pagewalk bootstrap';
let pgwkBootCreated = false;
async function ensureCloudAdmin() {
  try {
    const env = {};
    for (const line of fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim();
    }
    const db = require(path.join(PROJECT, 'node_modules', '@cloudbase', 'node-sdk'))
      .init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID }).database();
    const pm = require(path.join(PROJECT, 'cloudfunctions', 'auth', 'perm-matrix-shared.js'));
    const c = await db.collection('users').where({ openid: DEVTOOLS_OPENID }).get();
    if (c.data && c.data.length) { testDb = db; return; }
    await db.collection('users').add({ openid: DEVTOOLS_OPENID, name: PGWK_BOOT_NAME, role: 'admin', status: 'active', permissions: pm.defaultPermsForRole('admin'), createdBy: 'qa-pagewalk-test', createdAt: new Date(), updatedAt: new Date() });
    pgwkBootCreated = true;
    testDb = db;
  } catch (e) { console.warn('[warn] 云端 admin 自举失败：' + e.message); }
}
async function cleanupCloudAdmin() {
  try {
    if (testDb) {
      const c = await testDb.collection('users').where({ openid: DEVTOOLS_OPENID, name: PGWK_BOOT_NAME }).get();
      for (const d of c.data || []) await testDb.collection('users').doc(d._id).remove();
    }
  } catch (e) { console.warn('[warn] 自清理失败：' + e.message); }
}
async function resolveLatestOrderId() {
  try {
    const env = {};
    for (const line of fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    const cloudbase = require(path.join(PROJECT, 'node_modules', '@cloudbase', 'node-sdk'));
    const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID });
    const db = app.database();
    const res = await db.collection('orders').orderBy('createdAt', 'desc').limit(1).get();
    if (res.data && res.data.length) return res.data[0]._id;
    // T12 清数据后 orders 可能为空：造一条 TEST 订单实测深层页，脚本结束清理
    const cRes = await db.collection('customers').limit(1).get();
    const cust = cRes.data && cRes.data[0];
    const d = new Date();
    const dateStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const order = {
      orderNo: '丰淮商贸-' + dateStr + '-TEST0',
      customerId: cust ? cust._id : undefined,
      customerName: TEST_PGWK_TAG + '客户',
      customerRegion: cust ? (cust.region || '') : '',
      items: [{ name: TEST_PGWK_TAG + '商品', pricing_mode: 'piece', piece_qty: 1, package_qty: 0, price_piece: 50, price_unit: 0, qty: 1, price: 50, amount: 50 }],
      totalAmount: 50, status: 'submitted',
      payment_status: 'unpaid', paymentStatus: 'unpaid',
      received_amount: 0, receivedAmount: 0,
      sortStatus: 'pending', outStatus: 'pending',
      created_at: new Date(), createdAt: new Date()
    };
    const addRes = await db.collection('orders').add(order);
    createdTestOrderId = (addRes && (addRes._id || addRes.id)) || null;
    testDb = db;
    return createdTestOrderId;
  } catch (e) { console.warn('[warn] 取最新订单 id 失败：' + e.message); }
  return '3186bc486a7d87df002679e379929038';
}

// 每个探针都是自包含函数体（不引用外层变量）。
const PAGES = (ORDER_ID) => {
  const TABS = new Set(['/pages/index/index', '/pages/orders/orders', '/pages/receivable/receivable', '/pages/outbound/outbound', '/pages/profile/profile']);
  const defs = [
    { url: '/pages/index/index', name: 'home',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasUser: true }; } },
    { url: '/pages/orders/orders', name: 'orders',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, list: (p.data.list || p.data.orders || []).length }; } },
    { url: '/pages/new-order/new-order', name: 'new-order',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasForm: true }; } },
    { url: `/pages/order-detail/order-detail?id=${ORDER_ID}`, name: 'order-detail',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasOrder: !!p.data.order, items: (p.data.items || []).length }; },
      check: (d) => !!d.hasOrder, checkMsg: '订单详情未加载订单' },
    { url: '/pages/products/products', name: 'products',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, list: (p.data.list || p.data.products || []).length }; } },
    { url: '/pages/customers/customers', name: 'customers',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, list: (p.data.list || p.data.customers || []).length }; } },
    { url: '/pages/receivable/receivable', name: 'receivable',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, totalUnpaid: p.data.totalUnpaid, custs: (p.data.customers || []).length }; } },
    { url: '/pages/outbound/outbound', name: 'outbound',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, pendingOut: (p.data.pendingOut || []).length, pendingSort: (p.data.pendingSort || []).length }; } },
    { url: '/pages/reports/reports', name: 'reports',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasTab: true }; } },
    { url: `/pages/shipping/shipping?orderId=${ORDER_ID}`, name: 'shipping',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasOrder: !!p.data.order }; },
      check: (d) => !!d.hasOrder, checkMsg: '送货单未加载订单' },
    { url: '/pages/profile/profile', name: 'profile',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasProfile: true }; } },
    { url: '/pages/members/members', name: 'members',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; const ms = (p.data.members || []).filter((m) => m.status !== 'pending'); return { route: p.route, count: ms.length, blank: ms.filter((m) => !m.name || !m.role).length }; },
      check: (d) => (d.count || 0) >= 1 && (d.blank || 0) === 0,
      checkMsg: '存在空白成员卡片(缺 name/role)' },
    { url: '/pages/settings/settings', name: 'settings',
      probe: () => { const p = getCurrentPages()[getCurrentPages().length - 1]; return { route: p.route, hasSettings: true }; } },
  ];
  return defs.map((d) => Object.assign({}, d, { method: TABS.has(d.url.split('?')[0]) ? 'switchTab' : 'navigateTo' }));
};

(async () => {
  ensureDirFor(OUT_DIR);
  console.log('PROJECT ' + PROJECT);
  await ensureCloudAdmin();
  console.log('云端 admin 自举: ' + (pgwkBootCreated ? '新建临时 admin' : '已存在复用'));
  const ORDER_ID = await resolveLatestOrderId();
  console.log('ORDER_ID ' + ORDER_ID);

  const session = await launchSession({ projectPath: PROJECT, trustProject: true, timeoutMs: 90000 });
  await delay(5000);
  console.log('BOOT ' + (await session.currentPage()).path);
  // 登录自举（同 deepwalk：cli auto 会话无登录态，路由守卫会把需鉴权页踢回 login）
  try { await session.evaluate(async () => { try { if (!wx.cloud.config) { wx.cloud.init({ env: 'cloud1-d6g75loi673b1e039' }); } } catch (e) {} return 'ok'; }); await delay(1500); } catch (e) { }
  await session.evaluate(() => new Promise((r) => {
    try {
      const u = { openid: 'qa_pagewalk_admin', name: '测试', role: 'admin', tenantName: '丰淮商贸', permissions: ['order:view', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export', 'product:view', 'product:edit', 'customer:view', 'customer:edit', 'sort:task', 'warehouse:confirm', 'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount', 'report:view', 'report:export', 'report:ledger', 'member:manage'] };
      wx.setStorageSync('currentUser', u); wx.setStorageSync('userInfo', u); wx.setStorageSync('userRole', 'admin');
      try { const app = getApp(); if (app) { app.globalData.userInfo = u; app.globalData.userRole = 'admin'; } } catch (e) { }
      wx.reLaunch({ url: '/pages/index/index' }); r('ok');
    } catch (e) { r('THROW ' + e.message); }
  }));
  await delay(3500);

  const results = [];
  const pages = PAGES(ORDER_ID);
  for (let i = 0; i < pages.length; i++) {
    const spec = pages[i];
    const routeNoSlash = spec.url.split('?')[0].replace(/^\//, '');
    let nav = 'ok';
    try {
      await session.evaluate((m, u) => new Promise((res) => {
        try { wx[m]({ url: u, fail: (e) => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); }
      }), spec.method, spec.url);
    } catch (e) { nav = 'ERR:' + e.message; }
    await delay(2500);
    // 导航校验：当前页未落到目标则重试导航（慢加载/网络抖动防错位）
    for (let t = 0; t < 4; t++) {
      const chk = await session.currentPage();
      if (chk.path === routeNoSlash) break;
      try { await session.evaluate((m, u) => new Promise((res) => { try { wx[m]({ url: u, fail: () => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); } }), spec.method, spec.url); } catch (e) { }
      await delay(2500);
    }
    // 慢加载页（如 receivable 冷启动调云函数）：轮询当前页 loading 直到加载完成，上限 ~12s，避免探针抢跑读到初始空值
    try {
      const started = Date.now();
      while (Date.now() - started < 12000) {
        const st = await session.evaluate(() => {
          const p = getCurrentPages()[getCurrentPages().length - 1];
          return p && p.data && typeof p.data.loading === 'boolean' ? p.data.loading : null;
        });
        if (st === false || st === null) break;
        await delay(700);
      }
      await delay(300);
    } catch (e) { /* 读 loading 失败不阻断，继续按原逻辑 */ }

    const cur = await session.currentPage();
    let data = {};
    try { data = await session.evaluate(spec.probe) || {}; } catch (e) { data = { _probeErr: e.message }; }

    const file = path.join(OUT_DIR, String(i).padStart(2, '0') + '_' + spec.name + '.png');
    let bytes = -1;
    try { await session.screenshot({ path: file }); bytes = fs.statSync(file).size; } catch (e) { }

    const routeOk = cur.path === routeNoSlash;
    let checkOk = true; let checkMsg = '';
    if (spec.check) { checkOk = !!spec.check(data); checkMsg = spec.checkMsg || '数据断言失败'; }
    const pass = routeOk && bytes > 3000 && checkOk;

    console.log(`${pass ? 'PASS' : 'FAIL'} ${spec.name} cur=${cur.path} routeOk=${routeOk} bytes=${bytes} data=${JSON.stringify(data)}`);
    results.push({ name: spec.name, pass, routeOk, checkOk, checkMsg, bytes, file, data });
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n==== SUMMARY ====');
  console.log(`总页面 ${results.length}，通过 ${results.length - failed.length}，失败 ${failed.length}`);
  failed.forEach((f) => console.log(`  X ${f.name} routeOk=${f.routeOk} checkOk=${f.checkOk} ${f.checkMsg} bytes=${f.bytes} data=${JSON.stringify(f.data)}`));
  console.log('截图目录 ' + OUT_DIR);

  try {
    if (createdTestOrderId && testDb) {
      await testDb.collection('orders').where({ customerName: TEST_PGWK_TAG + '客户' }).remove().catch(() => {});
      console.log('[cleanup] TEST 订单已清理 createdId=' + createdTestOrderId);
    }
  } catch (e) { console.warn('[warn] 清理 TEST 订单失败：' + e.message); }

  if (pgwkBootCreated) { await cleanupCloudAdmin(); console.log('[cleanup] 临时云端 admin 已清理'); }
  const code = failed.length ? 1 : 0;
  try { await session.close(); } catch (e) {}
  process.exit(code);
})().catch(async (e) => { console.error('FATAL ' + e.message); try { if (pgwkBootCreated) await cleanupCloudAdmin(); } catch (_) {} process.exit(1); });
