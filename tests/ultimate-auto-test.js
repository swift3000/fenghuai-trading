/**
 * 终极自动化测试 - 深度代码分析 + 运行时验证
 * 尽可能自动化地发现和报告问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
const reportDir = path.join(projectRoot, 'tests/reports');
const logFile = path.join(reportDir, 'ultimate-test.log');
const screenshotDir = path.join(reportDir, 'screenshots');

// 确保目录存在
[reportDir, screenshotDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 日志函数
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
  screenshots: [],
  startTime: new Date().toISOString()
};

function test(category, name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      results.passed++;
      log(`✅ [${category}] ${name}`);
    } else if (result === 'warning') {
      results.warnings++;
      log(`⚠️  [${category}] ${name} - 警告`);
    } else {
      results.failed++;
      results.errors.push({ category, name, detail: result });
      log(`❌ [${category}] ${name}: ${result}`);
    }
  } catch (e) {
    results.failed++;
    results.errors.push({ category, name, error: e.message });
    log(`❌ [${category}] ${name}: ${e.message}`);
  }
}

// 开始测试
fs.writeFileSync(logFile, '');
log('='.repeat(70));
log('🚀 终极自动化测试开始');
log('='.repeat(70));
log('');

// ========== 阶段 1: 静态代码深度分析 ==========
log('📋 阶段 1: 静态代码深度分析');
log('-'.repeat(60));

// 1.1 文件完整性
test('文件完整性', '所有页面文件存在', () => {
  const pages = ['index', 'login', 'new-order', 'order-detail', 'orders', 
                 'products', 'customers', 'receivable', 'outbound', 
                 'reports', 'shipping', 'profile', 'members', 'settings'];
  const missing = [];
  for (const page of pages) {
    if (!fs.existsSync(path.join(projectRoot, 'pages', page, `${page}.js`))) 
      missing.push(`${page}.js`);
    if (!fs.existsSync(path.join(projectRoot, 'pages', page, `${page}.wxml`))) 
      missing.push(`${page}.wxml`);
    if (!fs.existsSync(path.join(projectRoot, 'pages', page, `${page}.wxss`))) 
      missing.push(`${page}.wxss`);
  }
  return missing.length === 0 ? true : `缺失文件：${missing.join(', ')}`;
});

// 1.2 云函数完整性
test('云函数完整性', '所有云函数配置完整', () => {
  const functions = fs.readdirSync(path.join(projectRoot, 'cloudfunctions'))
    .filter(f => fs.statSync(path.join(projectRoot, 'cloudfunctions', f)).isDirectory());
  
  const incomplete = [];
  for (const fn of functions) {
    const indexFile = path.join(projectRoot, 'cloudfunctions', fn, 'index.js');
    const configFile = path.join(projectRoot, 'cloudfunctions', fn, 'config.json');
    if (!fs.existsSync(indexFile)) incomplete.push(`${fn}/index.js`);
    if (!fs.existsSync(configFile)) incomplete.push(`${fn}/config.json`);
  }
  return incomplete.length === 0 ? true : `配置不完整：${incomplete.join(', ')}`;
});

// 1.3 WXML 语法深度检查
test('WXML 语法', '无嵌套三元表达式', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const errors = [];
  
  for (const page of fs.readdirSync(pagesDir)) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    
    const content = fs.readFileSync(wxmlFile, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('{{')) {
        const matches = line.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          for (const match of matches) {
            const inner = match.substring(2, match.length - 2);
            // 检测嵌套三元表达式
            if (inner.match(/\?.*:\s*\?.*:/)) {
              errors.push(`${page}.wxml 第${i+1}行: ${inner.substring(0, 50)}...`);
            }
          }
        }
      }
    }
  }
  
  return errors.length === 0 ? true : errors.join('; ');
});

// 1.4 wx:key 完整性
test('性能优化', '所有 wx:for 都有 wx:key', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const missing = [];
  
  for (const page of fs.readdirSync(pagesDir)) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    
    const content = fs.readFileSync(wxmlFile, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('wx:for=') && !line.includes('wx:key=')) {
        missing.push(`${page}.wxml 第${i+1}行`);
      }
    }
  }
  
  return missing.length === 0 ? true : `缺少 wx:key: ${missing.join(', ')}`;
});

// 1.5 TabBar 配置
test('TabBar 配置', '图标路径正确且文件存在', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  if (!appJson.tabBar || !appJson.tabBar.list) return 'TabBar 配置缺失';
  
  const missing = [];
  for (const item of appJson.tabBar.list) {
    if (item.iconPath && !fs.existsSync(path.join(projectRoot, item.iconPath))) {
      missing.push(item.iconPath);
    }
    if (item.selectedIconPath && !fs.existsSync(path.join(projectRoot, item.selectedIconPath))) {
      missing.push(item.selectedIconPath);
    }
  }
  
  return missing.length === 0 ? true : `缺失图标：${missing.join(', ')}`;
});

// 1.6 颜色系统一致性
test('颜色系统', '使用原型定义的颜色', () => {
  const appWxss = fs.readFileSync(path.join(projectRoot, 'app.wxss'), 'utf8');
  const requiredColors = ['#06AD56', '#FF6B35', '#F5F6F8'];
  const missing = [];
  
  for (const color of requiredColors) {
    if (!appWxss.includes(color)) {
      missing.push(color);
    }
  }
  
  return missing.length === 0 ? true : `缺失颜色：${missing.join(', ')}`;
});

// 1.7 关键功能逻辑
test('功能逻辑', '客户搜索功能完整', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  const checks = [
    newOrderJs.includes('customerSearchKeyword'),
    newOrderJs.includes('refreshCustomers'),
    newOrderJs.includes('includes(keyword)')
  ];
  return checks.every(c => c) ? true : '缺少搜索逻辑';
});

test('功能逻辑', '商品搜索功能完整', () => {
  const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  const checks = [
    newOrderJs.includes('productSearchKeyword'),
    newOrderJs.includes('refreshProducts')
  ];
  return checks.every(c => c) ? true : '缺少搜索逻辑';
});

test('功能逻辑', '数据加载有错误处理', () => {
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

// 1.8 云函数安全
test('云函数安全', 'orders 云函数有安全校验', () => {
  const ordersFn = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/orders/index.js'), 'utf8');
  const checks = [
    ordersFn.includes('escapeRegExp'),
    ordersFn.includes('checkPermission'),
    ordersFn.includes('OPENID')
  ];
  return checks.every(c => c) ? true : '缺少安全校验';
});

log('');

// ========== 阶段 2: 运行时验证（模拟） ==========
log('📋 阶段 2: 运行时验证（模拟）');
log('-'.repeat(60));

// 2.1 检查可能的运行时问题
test('运行时', '云函数可被调用（模拟）', () => {
  // 检查云函数是否可被 require
  try {
    const ordersPath = path.join(projectRoot, 'cloudfunctions/orders/index.js');
    // 不能真正 require 云函数，但检查文件存在和语法
    const content = fs.readFileSync(ordersPath, 'utf8');
    new Function(content.replace(/cloud\.init.*/, '').replace(/exports\.main.*/, ''));
    return true;
  } catch (e) {
    return `云函数语法错误：${e.message}`;
  }
});

// 2.2 检查数据加载逻辑
test('运行时', '首页数据加载逻辑完整', () => {
  const indexJs = fs.readFileSync(path.join(projectRoot, 'pages/index/index.js'), 'utf8');
  const checks = [
    indexJs.includes('loadTodayStats'),
    indexJs.includes('loadTodayOrders'),
    indexJs.includes('callCloud'),
    indexJs.includes('catch')
  ];
  return checks.every(c => c) ? true : '缺少数据加载逻辑';
});

log('');

// ========== 阶段 3: 与原型对比分析 ==========
log('📋 阶段 3: 与原型对比分析');
log('-'.repeat(60));

// 3.1 登录页对比
test('原型对比', '登录页无角色卡片（产品形态）', () => {
  const loginWxml = fs.readFileSync(path.join(projectRoot, 'pages/login/login.wxml'), 'utf8');
  // 检查是否有角色卡片选择（不应该有）
  if (loginWxml.includes('角色') || loginWxml.includes('张经理') || loginWxml.includes('周分拣')) {
    return '发现角色卡片选择（演示残留）';
  }
  return true;
});

// 3.2 首页对比
test('原型对比', '首页包含所有原型元素', () => {
  const indexWxml = fs.readFileSync(path.join(projectRoot, 'pages/index/index.wxml'), 'utf8');
  const requiredElements = [
    '智能录入',
    '新建订单',
    '商品管理',
    '客户管理',
    '报表导出',
    '今日订单'
  ];
  
  const missing = requiredElements.filter(el => !indexWxml.includes(el));
  return missing.length === 0 ? true : `缺少元素：${missing.join(', ')}`;
});

// 3.3 新建订单对比
test('原型对比', '新建订单包含客户/商品搜索', () => {
  const newOrderWxml = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.wxml'), 'utf8');
  const hasCustomerSearch = newOrderWxml.includes('搜索') && newOrderWxml.includes('客户');
  const hasProductSearch = newOrderWxml.includes('搜索') && newOrderWxml.includes('商品');
  
  if (!hasCustomerSearch) return '缺少客户搜索';
  if (!hasProductSearch) return '缺少商品搜索';
  return true;
});

log('');

// ========== 生成测试报告 ==========
log('='.repeat(70));
log('📊 测试结果汇总');
log('='.repeat(70));
log(`✅ 通过：${results.passed}`);
log(`⚠️  警告：${results.warnings}`);
log(`❌ 失败：${results.failed}`);
log(`📈 总计：${results.passed + results.warnings + results.failed}`);
log('');

// 保存详细报告
const report = {
  ...results,
  endTime: new Date().toISOString(),
  duration: Date.now() - new Date(results.startTime).getTime(),
  errors: results.errors,
  summary: results.failed === 0 ? 'READY_FOR_LAUNCH' : 'NEEDS_FIXING'
};

fs.writeFileSync(
  path.join(reportDir, 'ultimate-test-report.json'),
  JSON.stringify(report, null, 2)
);

// 生成人类可读报告
const humanReport = `
# 🤖 终极自动化测试报告

**测试时间**: ${results.startTime}  
**测试状态**: ${report.summary}  
**总耗时**: ${Math.round(report.duration / 1000)}秒

## 测试结果
- ✅ 通过：${results.passed}
- ⚠️  警告：${results.warnings}
- ❌ 失败：${results.failed}

## 详细错误
${results.errors.length === 0 ? '无错误' : results.errors.map(e => 
  `- **${e.category}**: ${e.name}\n  ${e.detail || e.error}`
).join('\n\n')}

## 建议
${results.failed === 0 ? 
  '🎉 所有测试通过！小程序已准备就绪，可以上线测试！' :
  '⚠️  发现一些问题，请根据上述提示进行修复。'
}

## 下一步
1. 在微信开发者工具中点击"编译"
2. 手动验证关键功能
3. 确认无误后上传审核
`.trim();

fs.writeFileSync(path.join(reportDir, 'TEST_REPORT.md'), humanReport);

// 输出总结
console.log('');
console.log('='.repeat(70));
if (results.failed === 0) {
  console.log('🎉 所有测试通过！小程序已准备就绪！');
  console.log('');
  console.log('📄 测试报告已生成:');
  console.log(`   - 详细报告：${path.join(reportDir, 'ultimate-test-report.json')}`);
  console.log(`   - 人类报告：${path.join(reportDir, 'TEST_REPORT.md')}`);
  console.log(`   - 测试日志：${logFile}`);
  console.log('');
  console.log('✅ 下一步操作:');
  console.log('   1. 在微信开发者工具中点击"编译"');
  console.log('   2. 手动验证关键功能（登录、下单、搜索等）');
  console.log('   3. 确认无误后点击"上传"提交审核');
} else {
  console.log('❌ 发现一些问题，请修复后再上线。');
  console.log('');
  console.log('📄 详细错误列表:');
  results.errors.forEach((e, i) => {
    console.log(`   ${i + 1}. [${e.category}] ${e.name}: ${e.detail || e.error}`);
  });
  console.log('');
  console.log('📄 完整报告: ' + path.join(reportDir, 'TEST_REPORT.md'));
}
console.log('='.repeat(70));

process.exit(results.failed === 0 ? 0 : 1);
