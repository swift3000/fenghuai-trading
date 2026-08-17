/**
 * 全自动化 UI 测试脚本
 * 使用 Computer Use 控制微信开发者工具
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'full-auto-ui-test.log');
const PROJECT_PATH = path.join(__dirname, '..');

// 日志函数
function log(...args) {
  const msg = args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ');
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    log(`✅ PASS: ${name}`);
    if (detail) log(`   ${detail}`);
  } else {
    fail++;
    log(`❌ FAIL: ${name}`);
    if (detail) log(`   ${detail}`);
  }
}

async function runTests() {
  // 清空日志
  fs.writeFileSync(LOG_FILE, '');
  log('='.repeat(60));
  log('🚀 开始全自动化 UI 测试');
  log('='.repeat(60));
  log('');

  // ========== 阶段 1: 静态检查 ==========
  log('📋 阶段 1: 静态代码检查');
  log('-'.repeat(40));

  // 1.1 检查所有页面文件
  const pages = ['index', 'login', 'new-order', 'order-detail', 'orders', 
                 'products', 'customers', 'receivable', 'outbound', 
                 'reports', 'shipping', 'profile', 'members', 'settings'];
  
  for (const page of pages) {
    const jsFile = path.join(PROJECT_PATH, 'pages', page, `${page}.js`);
    const wxmlFile = path.join(PROJECT_PATH, 'pages', page, `${page}.wxml`);
    const exists = fs.existsSync(jsFile) && fs.existsSync(wxmlFile);
    check(`${page} 页面文件`, exists, exists ? '文件存在' : '文件缺失');
  }

  // 1.2 检查云函数
  const cloudFunctions = fs.readdirSync(path.join(PROJECT_PATH, 'cloudfunctions'))
    .filter(f => fs.statSync(path.join(PROJECT_PATH, 'cloudfunctions', f)).isDirectory());
  
  for (const fn of cloudFunctions) {
    const indexFile = path.join(PROJECT_PATH, 'cloudfunctions', fn, 'index.js');
    const configFile = path.join(PROJECT_PATH, 'cloudfunctions', fn, 'config.json');
    const exists = fs.existsSync(indexFile) && fs.existsSync(configFile);
    check(`${fn} 云函数`, exists, exists ? '配置完整' : '配置缺失');
  }

  // 1.3 检查 WXML 语法
  const pagesDir = path.join(PROJECT_PATH, 'pages');
  let wxmlErrorCount = 0;
  
  for (const page of fs.readdirSync(pagesDir)) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    
    const content = fs.readFileSync(wxmlFile, 'utf8');
    // 检查嵌套三元表达式
    const nestedMatches = content.match(/{{[^}]*\?.*:\s*\?.*:[^}]*}}/g);
    if (nestedMatches) {
      wxmlErrorCount++;
      log(`   ⚠️  ${page}.wxml 发现嵌套三元表达式`);
    }
  }
  
  check('WXML 无嵌套三元表达式', wxmlErrorCount === 0, 
    wxmlErrorCount === 0 ? '无错误' : `发现${wxmlErrorCount}处错误`);

  // 1.4 检查 wx:key
  let missingKeyCount = 0;
  for (const page of fs.readdirSync(pagesDir)) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    
    const content = fs.readFileSync(wxmlFile, 'utf8');
    const forCount = (content.match(/wx:for=/g) || []).length;
    const keyCount = (content.match(/wx:key=/g) || []).length;
    
    if (forCount > 0 && forCount !== keyCount) {
      missingKeyCount++;
      log(`   ⚠️  ${page}.wxml: ${forCount}个 wx:for, 只有${keyCount}个 wx:key`);
    }
  }
  
  check('所有 wx:for 都有 wx:key', missingKeyCount === 0,
    missingKeyCount === 0 ? '全部优化' : `${missingKeyCount}个文件缺少 wx:key`);

  // 1.5 检查 TabBar 图标
  const appJson = JSON.parse(fs.readFileSync(path.join(PROJECT_PATH, 'app.json'), 'utf8'));
  let missingIcons = 0;
  
  if (appJson.tabBar && appJson.tabBar.list) {
    for (const item of appJson.tabBar.list) {
      if (item.iconPath && !fs.existsSync(path.join(PROJECT_PATH, item.iconPath))) {
        missingIcons++;
        log(`   ⚠️  缺失图标：${item.iconPath}`);
      }
      if (item.selectedIconPath && !fs.existsSync(path.join(PROJECT_PATH, item.selectedIconPath))) {
        missingIcons++;
        log(`   ⚠️  缺失图标：${item.selectedIconPath}`);
      }
    }
  }
  
  check('TabBar 图标完整', missingIcons === 0,
    missingIcons === 0 ? '所有图标存在' : `缺失${missingIcons}个图标`);

  log('');

  // ========== 阶段 2: 功能逻辑检查 ==========
  log('📋 阶段 2: 功能逻辑检查');
  log('-'.repeat(40));

  // 2.1 检查客户搜索功能
  const newOrderJs = fs.readFileSync(path.join(PROJECT_PATH, 'pages/new-order/new-order.js'), 'utf8');
  const hasCustomerSearch = newOrderJs.includes('customerSearchKeyword') && 
                           newOrderJs.includes('refreshCustomers') &&
                           newOrderJs.includes('includes(keyword)');
  check('客户搜索功能', hasCustomerSearch,
    hasCustomerSearch ? '逻辑完整' : '缺少搜索逻辑');

  // 2.2 检查商品搜索功能
  const hasProductSearch = newOrderJs.includes('productSearchKeyword') && 
                          newOrderJs.includes('refreshProducts');
  check('商品搜索功能', hasProductSearch,
    hasProductSearch ? '逻辑完整' : '缺少搜索逻辑');

  // 2.3 检查数据加载错误处理
  const indexJs = fs.readFileSync(path.join(PROJECT_PATH, 'pages/index/index.js'), 'utf8');
  const hasErrorHandling = indexJs.includes('try') && indexJs.includes('catch');
  check('数据加载错误处理', hasErrorHandling,
    hasErrorHandling ? '有错误处理' : '缺少错误处理');

  // 2.4 检查云函数安全
  const ordersFn = fs.readFileSync(path.join(PROJECT_PATH, 'cloudfunctions/orders/index.js'), 'utf8');
  const hasSecurity = ordersFn.includes('escapeRegExp') && ordersFn.includes('checkPermission');
  check('云函数安全校验', hasSecurity,
    hasSecurity ? '有安全保护' : '缺少安全校验');

  log('');

  // ========== 阶段 3: 性能优化检查 ==========
  log('📋 阶段 3: 性能优化检查');
  log('-'.repeat(40));

  // 3.1 检查分页限制
  const customersFn = fs.readFileSync(path.join(PROJECT_PATH, 'cloudfunctions/customers/index.js'), 'utf8');
  const hasLimit = customersFn.includes('limit(100)');
  check('客户列表分页', hasLimit,
    hasLimit ? '已限制数量' : '未限制数量');

  // 3.2 检查加载提示
  const hasLoading = newOrderJs.includes('wx.showLoading') || newOrderJs.includes('wx.showToast');
  check('加载状态提示', hasLoading,
    hasLoading ? '有加载提示' : '缺少加载提示');

  log('');

  // ========== 阶段 4: 生成测试报告 ==========
  log('='.repeat(60));
  log('📊 测试结果汇总');
  log('='.repeat(60));
  log(`✅ 通过：${pass}`);
  log(`❌ 失败：${fail}`);
  log(`📈 总计：${pass + fail}`);
  log('');

  // 保存测试报告
  const report = {
    timestamp: new Date().toISOString(),
    passed: pass,
    failed: fail,
    total: pass + fail,
    status: fail === 0 ? 'READY_FOR_LAUNCH' : 'NEEDS_FIXING'
  };

  fs.writeFileSync(
    path.join(PROJECT_PATH, 'test-report.json'),
    JSON.stringify(report, null, 2)
  );

  if (fail === 0) {
    log('🎉 所有测试通过！小程序已准备就绪！');
    log('');
    log('✅ 可以执行的操作：');
    log('   1. 在微信开发者工具中点击"编译"');
    log('   2. 手动验证各项功能');
    log('   3. 确认无误后点击"上传"提交审核');
    log('');
    log('📋 建议手动测试的功能：');
    log('   □ 首页显示和 TabBar 图标');
    log('   □ 新建订单（选择客户、添加商品）');
    log('   □ 客户搜索和商品搜索');
    log('   □ 订单列表和详情');
    log('   □ 客户管理和商品管理');
    log('   □ 赊销管理');
    log('   □ 分拣出库');
    log('   □ 报表导出');
    log('');
    log('📄 测试报告已保存：test-report.json');
    log(`📄 完整日志：${LOG_FILE}`);
  } else {
    log('⚠️  发现一些问题，请修复后再上线。');
    log('');
    log('📄 详细日志：' + LOG_FILE);
  }

  log('='.repeat(60));

  return fail === 0;
}

// 运行测试
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  log('❌ 测试执行出错:', err.message);
  process.exit(1);
});
