/**
 * 完整自动化测试脚本
 * 测试小程序的所有核心功能
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
const logFile = path.join(projectRoot, 'full-automation-test.log');

// 日志函数
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      log(`✅ ${name}`);
    } else {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', detail: result });
      log(`❌ ${name}: ${result}`);
    }
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: 'ERROR', detail: e.message });
    log(`❌ ${name}: ${e.message}`);
  }
}

// 开始测试
log('='.repeat(60));
log('🚀 开始完整自动化测试...');
log('='.repeat(60));
log('');

// 清空日志文件
fs.writeFileSync(logFile, '');

// ========== 1. 静态代码检查 ==========
log('📋 1. 静态代码检查');
log('-'.repeat(40));

test('检查所有页面文件存在', () => {
  const pages = ['index', 'login', 'new-order', 'order-detail', 'orders', 
                 'products', 'customers', 'receivable', 'outbound', 
                 'reports', 'shipping', 'profile', 'members', 'settings'];
  for (const page of pages) {
    const jsFile = path.join(projectRoot, 'pages', page, `${page}.js`);
    const wxmlFile = path.join(projectRoot, 'pages', page, `${page}.wxml`);
    if (!fs.existsSync(jsFile)) return `缺少 ${page}.js`;
    if (!fs.existsSync(wxmlFile)) return `缺少 ${page}.wxml`;
  }
  return true;
});

test('检查云函数文件存在', () => {
  const functions = ['orders', 'customers', 'products', 'auth', 'receivable', 
                     'report', 'regions', 'system', 'smart', 'users', 
                     'import-data', 'check-customer-fields', 'clear-all-data'];
  for (const fn of functions) {
    const indexFile = path.join(projectRoot, 'cloudfunctions', fn, 'index.js');
    const configFile = path.join(projectRoot, 'cloudfunctions', fn, 'config.json');
    if (!fs.existsSync(indexFile)) return `缺少 ${fn}/index.js`;
    if (!fs.existsSync(configFile)) return `缺少 ${fn}/config.json`;
  }
  return true;
});

test('检查 WXML 无语法错误', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    const content = fs.readFileSync(wxmlFile, 'utf8');
    // 检查嵌套三元表达式
    if (content.match(/{{[^}]*\?.*:.*\?.*:[^}]*}}/)) {
      return `发现嵌套三元表达式 in ${page}.wxml`;
    }
  }
  return true;
});

test('检查所有 wx:for 都有 wx:key', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    const content = fs.readFileSync(wxmlFile, 'utf8');
    const forMatches = content.match(/wx:for="[^"]*"/g) || [];
    const keyMatches = content.match(/wx:key="[^"]*"/g) || [];
    if (forMatches.length !== keyMatches.length) {
      return `${page}.wxml: ${forMatches.length}个 wx:for, 但只有 ${keyMatches.length}个 wx:key`;
    }
  }
  return true;
});

test('检查 JS 文件语法', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const jsFile = path.join(pagesDir, page, `${page}.js`);
    if (!fs.existsSync(jsFile)) continue;
    try {
      // 简单的语法检查
      const content = fs.readFileSync(jsFile, 'utf8');
      new Function(content.replace(/Page\(/, '(').replace(/getApp\(\)/, '{}'));
    } catch (e) {
      return `JS 语法错误 in ${page}.js: ${e.message}`;
    }
  }
  return true;
});

test('检查 TabBar 图标配置', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  if (!appJson.tabBar || !appJson.tabBar.list) return 'TabBar 配置缺失';
  
  const icons = appJson.tabBar.list.flatMap(item => [item.iconPath, item.selectedIconPath]);
  for (const icon of icons) {
    if (icon && !fs.existsSync(path.join(projectRoot, icon))) {
      return `缺失图标：${icon}`;
    }
  }
  return true;
});

log('');

// ========== 2. 数据加载逻辑检查 ==========
log('📋 2. 数据加载逻辑检查');
log('-'.repeat(40));

test('检查首页数据加载', () => {
  const indexJs = fs.readFileSync(path.join(projectRoot, 'pages/index/index.js'), 'utf8');
  if (!indexJs.includes('loadTodayStats')) return '缺少 loadTodayStats 方法';
  if (!indexJs.includes('loadTodayOrders')) return '缺少 loadTodayOrders 方法';
  if (!indexJs.includes('catch')) return '缺少错误处理';
  return true;
});

test('检查新建订单客户加载', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!newOrderJs.includes('loadCustomers')) return '缺少 loadCustomers 方法';
  if (!newOrderJs.includes('refreshCustomers')) return '缺少 refreshCustomers 方法';
  if (!newOrderJs.includes('catch')) return '缺少错误处理';
  return true;
});

test('检查新建订单商品加载', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!newOrderJs.includes('loadProducts')) return '缺少 loadProducts 方法';
  if (!newOrderJs.includes('refreshProducts')) return '缺少 refreshProducts 方法';
  return true;
});

test('检查客户搜索功能', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!newOrderJs.includes('customerSearchKeyword')) return '缺少客户搜索功能';
  if (!newOrderJs.includes('includes(keyword)')) return '搜索逻辑不完整';
  return true;
});

test('检查商品搜索功能', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!newOrderJs.includes('productSearchKeyword')) return '缺少商品搜索功能';
  return true;
});

log('');

// ========== 3. 云函数逻辑检查 ==========
log('📋 3. 云函数逻辑检查');
log('-'.repeat(40));

test('检查 orders 云函数', () => {
  const ordersFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/orders/index.js'), 'utf8');
  if (!ordersFn.includes('case \'create\'')) return '缺少创建订单逻辑';
  if (!ordersFn.includes('case \'list\'')) return '缺少订单列表逻辑';
  if (!ordersFn.includes('case \'detail\'')) return '缺少订单详情逻辑';
  if (!ordersFn.includes('escapeRegExp')) return '缺少正则转义，可能导致安全漏洞';
  return true;
});

test('检查 customers 云函数', () => {
  const customersFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/customers/index.js'), 'utf8');
  if (!customersFn.includes('case \'list\'')) return '缺少客户列表逻辑';
  if (!customersFn.includes('case \'create\'')) return '缺少创建客户逻辑';
  if (!customersFn.includes('escapeRegExp')) return '缺少正则转义';
  return true;
});

test('检查 products 云函数', () => {
  const productsFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/products/index.js'), 'utf8');
  if (!productsFn.includes('case \'list\'')) return '缺少商品列表逻辑';
  if (!productsFn.includes('case \'create\'')) return '缺少创建商品逻辑';
  return true;
});

log('');

// ========== 4. 性能优化检查 ==========
log('📋 4. 性能优化检查');
log('-'.repeat(40));

test('检查数据分页加载', () => {
  const customersFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/customers/index.js'), 'utf8');
  if (!customersFn.includes('limit(100)')) return '客户列表未限制数量，可能导致性能问题';
  return true;
});

test('检查订单列表分页', () => {
  const ordersFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/orders/index.js'), 'utf8');
  if (!ordersFn.includes('limit(200)')) return '订单列表未限制数量';
  return true;
});

test('检查错误处理完善', () => {
  const pages = ['index', 'new-order', 'orders', 'customers', 'products'];
  for (const page of pages) {
    const jsFile = path.join(projectRoot, 'pages', page, `${page}.js`);
    if (!fs.existsSync(jsFile)) continue;
    const content = fs.readFileSync(jsFile, 'utf8');
    if (content.includes('callCloud') && !content.includes('catch')) {
      return `${page}.js 缺少错误处理`;
    }
  }
  return true;
});

log('');

// ========== 测试结果汇总 ==========
log('='.repeat(60));
log('📊 测试结果汇总');
log('='.repeat(60));
log(`✅ 通过：${results.passed}`);
log(`❌ 失败：${results.failed}`);
log(`📈 总计：${results.passed + results.failed}`);
log('');

if (results.failed === 0) {
  log('🎉 所有测试通过！小程序准备就绪！');
  log('');
  log('下一步操作：');
  log('1. 在微信开发者工具中点击"编译"');
  log('2. 测试各项功能');
  log('3. 确认无误后上线');
} else {
  log('⚠️  发现一些问题，请根据上述提示进行修复。');
  log('');
  log('失败的测试项：');
  results.tests
    .filter(t => t.status !== 'PASS')
    .forEach(t => log(`  - ${t.name}: ${t.detail}`));
}

log('='.repeat(60));

// 保存测试结果
const summary = {
  timestamp: new Date().toISOString(),
  passed: results.passed,
  failed: results.failed,
  total: results.passed + results.failed,
  tests: results.tests
};

fs.writeFileSync(
  path.join(projectRoot, 'test-summary.json'),
  JSON.stringify(summary, null, 2)
);

log('');
log(`📄 详细测试报告已保存到：test-summary.json`);
log(`📄 完整日志已保存到：${logFile}`);

process.exit(results.failed ? 1 : 0);
