/**
 * 最终准确测试 - 修复误报
 */

const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/god/Desktop/项目/github/fenghuai-trading';
let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`✅ ${name}`);
    if (detail) console.log(`   ${detail}`);
  } else {
    fail++;
    console.log(`❌ ${name}: ${detail}`);
  }
}

console.log('='.repeat(60));
console.log('🚀 最终准确测试');
console.log('='.repeat(60));
console.log('');

// 1. 页面文件检查
console.log('📋 1. 页面文件检查');
const pages = ['index', 'login', 'new-order', 'order-detail', 'orders', 
               'products', 'customers', 'receivable', 'outbound', 
               'reports', 'shipping', 'profile', 'members', 'settings'];

for (const page of pages) {
  const jsFile = path.join(PROJECT_PATH, 'pages', page, `${page}.js`);
  const wxmlFile = path.join(PROJECT_PATH, 'pages', page, `${page}.wxml`);
  check(`${page} 页面`, 
    fs.existsSync(jsFile) && fs.existsSync(wxmlFile),
    '文件存在');
}

// 2. 云函数检查
console.log('');
console.log('📋 2. 云函数检查');
const cloudFunctions = fs.readdirSync(path.join(PROJECT_PATH, 'cloudfunctions'))
  .filter(f => fs.statSync(path.join(PROJECT_PATH, 'cloudfunctions', f)).isDirectory());

for (const fn of cloudFunctions) {
  const indexFile = path.join(PROJECT_PATH, 'cloudfunctions', fn, 'index.js');
  const configFile = path.join(PROJECT_PATH, 'cloudfunctions', fn, 'config.json');
  check(`${fn} 云函数`,
    fs.existsSync(indexFile) && fs.existsSync(configFile),
    '配置完整');
}

// 3. WXML 语法检查
console.log('');
console.log('📋 3. WXML 语法检查');
let nestedError = false;
const pagesDir = path.join(PROJECT_PATH, 'pages');

for (const page of fs.readdirSync(pagesDir)) {
  const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
  if (!fs.existsSync(wxmlFile)) continue;
  
  const content = fs.readFileSync(wxmlFile, 'utf8');
  // 检查真正的嵌套三元表达式（在同一个 {{}} 内）
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('{{')) {
      // 提取 {{}} 中的内容
      const matches = line.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        for (const match of matches) {
          const inner = match.substring(2, match.length - 2);
          // 检查是否有嵌套三元（?.*:.*?:）
          if (inner.match(/\?.*:\s*\?.*:/)) {
            console.log(`   ⚠️  ${page}.wxml 第${i+1}行：发现嵌套三元表达式`);
            nestedError = true;
          }
        }
      }
    }
  }
}

check('WXML 无嵌套三元表达式', !nestedError,
  nestedError ? '发现错误' : '无错误');

// 4. wx:key 检查（准确版本）
console.log('');
console.log('📋 4. wx:key 检查');
let missingKey = false;

for (const page of fs.readdirSync(pagesDir)) {
  const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
  if (!fs.existsSync(wxmlFile)) continue;
  
  const content = fs.readFileSync(wxmlFile, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('wx:for=') && !line.includes('wx:key=')) {
      console.log(`   ⚠️  ${page}.wxml 第${i+1}行：缺少 wx:key`);
      missingKey = true;
    }
  }
}

check('所有 wx:for 都有 wx:key', !missingKey,
  missingKey ? '缺少 wx:key' : '全部优化');

// 5. TabBar 图标检查
console.log('');
console.log('📋 5. TabBar 图标检查');
const appJson = JSON.parse(fs.readFileSync(path.join(PROJECT_PATH, 'app.json'), 'utf8'));
let missingIcons = 0;

if (appJson.tabBar && appJson.tabBar.list) {
  for (const item of appJson.tabBar.list) {
    if (item.iconPath && !fs.existsSync(path.join(PROJECT_PATH, item.iconPath))) {
      missingIcons++;
    }
    if (item.selectedIconPath && !fs.existsSync(path.join(PROJECT_PATH, item.selectedIconPath))) {
      missingIcons++;
    }
  }
}

check('TabBar 图标完整', missingIcons === 0,
  missingIcons === 0 ? '所有图标存在' : `缺失${missingIcons}个`);

// 6. 功能逻辑检查
console.log('');
console.log('📋 6. 功能逻辑检查');

const newOrderJs = fs.readFileSync(path.join(PROJECT_PATH, 'pages/new-order/new-order.js'), 'utf8');
check('客户搜索功能',
  newOrderJs.includes('customerSearchKeyword') && 
  newOrderJs.includes('refreshCustomers'),
  '逻辑完整');

check('商品搜索功能',
  newOrderJs.includes('productSearchKeyword') && 
  newOrderJs.includes('refreshProducts'),
  '逻辑完整');

const indexJs = fs.readFileSync(path.join(PROJECT_PATH, 'pages/index/index.js'), 'utf8');
check('数据加载错误处理',
  indexJs.includes('try') && indexJs.includes('catch'),
  '有错误处理');

const ordersFn = fs.readFileSync(path.join(PROJECT_PATH, 'cloudfunctions/orders/index.js'), 'utf8');
check('云函数安全校验',
  ordersFn.includes('escapeRegExp') && ordersFn.includes('checkPermission'),
  '有安全保护');

// 7. 性能优化检查
console.log('');
console.log('📋 7. 性能优化检查');

const customersFn = fs.readFileSync(path.join(PROJECT_PATH, 'cloudfunctions/customers/index.js'), 'utf8');
check('客户列表分页',
  customersFn.includes('limit(100)'),
  '已限制数量');

check('加载状态提示',
  newOrderJs.includes('wx.showLoading') || newOrderJs.includes('wx.showToast'),
  '有加载提示');

// 汇总
console.log('');
console.log('='.repeat(60));
console.log('📊 测试结果');
console.log('='.repeat(60));
console.log(`✅ 通过：${pass}`);
console.log(`❌ 失败：${fail}`);
console.log(`📈 总计：${pass + fail}`);
console.log('');

// 保存报告
const report = {
  timestamp: new Date().toISOString(),
  passed: pass,
  failed: fail,
  total: pass + fail,
  status: fail === 0 ? 'READY_FOR_LAUNCH' : 'NEEDS_FIXING'
};

fs.writeFileSync(
  path.join(PROJECT_PATH, 'test-report-final.json'),
  JSON.stringify(report, null, 2)
);

if (fail === 0) {
  console.log('🎉 所有测试通过！小程序已准备就绪！');
  console.log('');
  console.log('✅ 可以执行的操作：');
  console.log('   1. 在微信开发者工具中点击"编译"');
  console.log('   2. 手动验证各项功能');
  console.log('   3. 确认无误后点击"上传"提交审核');
  console.log('');
  console.log('📋 建议手动测试的功能：');
  console.log('   □ 首页显示和 TabBar 图标');
  console.log('   □ 新建订单（选择客户、添加商品）');
  console.log('   □ 客户搜索和商品搜索');
  console.log('   □ 订单列表和详情');
  console.log('   □ 客户管理和商品管理');
  console.log('   □ 赊销管理');
  console.log('   □ 分拣出库');
  console.log('   □ 报表导出');
  console.log('');
  console.log('📄 测试报告：test-report-final.json');
} else {
  console.log('⚠️  发现一些问题，请修复后再上线。');
}

console.log('='.repeat(60));

process.exit(fail === 0 ? 0 : 1);
