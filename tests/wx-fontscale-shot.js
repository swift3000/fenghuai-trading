#!/usr/bin/env node
/**
 * 放大字体走查：把 fontScale 提到 1.2（用户看截图更清楚），逐页截图后恢复原值。
 * 运行：node tests/wx-fontscale-shot.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const PROJECT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT, 'output', 'wx-fontscale-test');
const AUTOMATOR_LIB = process.env.WX_AUTOMATOR_LIB || path.join(os.homedir(), '.codex', 'skills', 'wechat-devtools-automator', 'scripts', 'lib');
const { launchSession } = require(path.join(AUTOMATOR_LIB, 'devtools_client.js'));
const { delay, ensureDirFor } = require(path.join(AUTOMATOR_LIB, 'common.js'));

const PAGES = [
  { url: '/pages/index/index', name: 'home', method: 'switchTab' },
  { url: '/pages/orders/orders', name: 'orders', method: 'switchTab' },
  { url: '/pages/new-order/new-order', name: 'new-order', method: 'navigateTo' },
  { url: '/pages/products/products', name: 'products', method: 'navigateTo' },
  { url: '/pages/customers/customers', name: 'customers', method: 'navigateTo' },
  { url: '/pages/receivable/receivable', name: 'receivable', method: 'navigateTo' },
  { url: '/pages/outbound/outbound', name: 'outbound', method: 'switchTab' },
  { url: '/pages/reports/reports', name: 'reports', method: 'navigateTo' },
  { url: '/pages/profile/profile', name: 'profile', method: 'switchTab' },
  { url: '/pages/members/members', name: 'members', method: 'navigateTo' },
  { url: '/pages/settings/settings', name: 'settings', method: 'navigateTo' },
];

(async () => {
  ensureDirFor(OUT_DIR);
  const session = await launchSession({ projectPath: PROJECT, trustProject: true, timeoutMs: 90000 });
  await delay(5000);
  console.log('BOOT ' + (await session.currentPage()).path);

  // 记录原字号 -> 提到 1.2
  const orig = await session.evaluate(() => wx.getStorageSync('fontScale'));
  console.log('ORIG_SCALE ' + JSON.stringify(orig));
  await session.evaluate((v) => { wx.setStorageSync('fontScale', v); }, 1.2);

  for (let i = 0; i < PAGES.length; i++) {
    const spec = PAGES[i];
    const routeNoSlash = spec.url.split('?')[0].replace(/^\//, '');
    try {
      await session.evaluate((m, u) => new Promise((res) => {
        try { wx[m]({ url: u, fail: (e) => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); }
      }), spec.method, spec.url);
    } catch (e) { console.log('NAV_ERR ' + spec.name + ' ' + e.message); }
    await delay(2500);
    for (let t = 0; t < 4; t++) {
      const chk = await session.currentPage();
      if (chk.path === routeNoSlash) break;
      try { await session.evaluate((m, u) => new Promise((res) => { try { wx[m]({ url: u, fail: () => res('FAIL') }); setTimeout(() => res('ok'), 2500); } catch (e) { res('THROW'); } }), spec.method, spec.url); } catch (e) {}
      await delay(2500);
    }
    // 等 loading 结束（上限 12s）
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
    } catch (e) {}
    const cur = await session.currentPage();
    const file = path.join(OUT_DIR, String(i).padStart(2, '0') + '_' + spec.name + '.png');
    let bytes = -1;
    try { await session.screenshot({ path: file }); bytes = fs.statSync(file).size; } catch (e) {}
    console.log((cur.path === routeNoSlash ? 'PASS' : 'FAIL') + ' ' + spec.name + ' cur=' + cur.path + ' bytes=' + bytes);
  }

  // 恢复原字号
  await session.evaluate((v) => { wx.setStorageSync('fontScale', v); }, (orig === '' || orig === null || orig === undefined) ? 0.9 : orig);
  console.log('RESTORED ' + JSON.stringify(orig));
  await session.close();
  console.log('DONE 截图目录 ' + OUT_DIR);
})().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });

