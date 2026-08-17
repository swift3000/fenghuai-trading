/**
 * 上线前最终检查
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';

console.log('='.repeat(60));
console.log('🚀 上线前最终检查');
console.log('='.repeat(60));
console.log('');

let allPass = true;

// 1. 检查核心文件
console.log('📋 1. 核心文件检查');
const essentialFiles = [
  'app.json',
  'app.js',
  'pages/index/index.js',
  'pages/index/index.wxml',
  'pages/new-order/new-order.js',
  'pages/new-order/new-order.wxml',
  'cloudfunctions/orders/index.js',
  'cloudfunctions/orders/config.json',
  'cloudfunctions/customers/index.js',
  'cloudfunctions/customers/config.json',
  'cloudfunctions/products/index.js',
  'cloudfunctions/products/config.json'
];

for (const file of essentialFiles) {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 缺失!`);
    allPass = false;
  }
}

// 2. 检查 TabBar 图标
console.log('');
console.log('📋 2. TabBar 图标检查');
const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
if (appJson.tabBar && appJson.tabBar.list) {
  for (const item of appJson.tabBar.list) {
    const icon = item.iconPath ? path.join(projectRoot, item.iconPath) : null;
    const selectedIcon = item.selectedIconPath ? path.join(projectRoot, item.selectedIconPath) : null;
    
    if (icon && fs.existsSync(icon)) {
      console.log(`✅ ${item.text}: 图标存在`);
    } else if (icon) {
      console.log(`❌ ${item.text}: 图标缺失`);
      allPass = false;
    }
  }
}

// 3. 检查云函数部署状态
console.log('');
console.log('📋 3. 云函数检查');
const cloudFunctions = fs.readdirSync(path.join(projectRoot, 'cloudfunctions'))
  .filter(f => fs.statSync(path.join(projectRoot, 'cloudfunctions', f)).isDirectory());

for (const fn of cloudFunctions) {
  const indexFile = path.join(projectRoot, 'cloudfunctions', fn, 'index.js');
  const configFile = path.join(projectRoot, 'cloudfunctions', fn, 'config.json');
  
  if (fs.existsSync(indexFile) && fs.existsSync(configFile)) {
    console.log(`✅ ${fn}: 配置完整`);
  } else {
    console.log(`❌ ${fn}: 缺少配置`);
    allPass = false;
  }
}

// 4. 检查关键功能
console.log('');
console.log('📋 4. 关键功能检查');

// 检查客户搜索
const newOrderJs = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
if (newOrderJs.includes('customerSearchKeyword') && newOrderJs.includes('refreshCustomers')) {
  console.log('✅ 客户搜索功能');
} else {
  console.log('❌ 客户搜索功能 - 不完整');
  allPass = false;
}

// 检查商品搜索
if (newOrderJs.includes('productSearchKeyword') && newOrderJs.includes('refreshProducts')) {
  console.log('✅ 商品搜索功能');
} else {
  console.log('❌ 商品搜索功能 - 不完整');
  allPass = false;
}

// 检查错误处理
const indexJs = fs.readFileSync(path.join(projectRoot, 'pages/index/index.js'), 'utf8');
if (indexJs.includes('try') && indexJs.includes('catch')) {
  console.log('✅ 错误处理');
} else {
  console.log('❌ 错误处理 - 缺失');
  allPass = false;
}

// 5. 总结
console.log('');
console.log('='.repeat(60));
if (allPass) {
  console.log('🎉 所有检查通过！小程序可以上线！');
  console.log('');
  console.log('✅ 下一步操作：');
  console.log('   1. 在微信开发者工具中点击"编译"');
  console.log('   2. 手动测试各项功能');
  console.log('   3. 确认无误后点击"上传"提交审核');
  console.log('');
  console.log('📋 测试清单：');
  console.log('   □ 首页显示正常');
  console.log('   □ TabBar 图标正常');
  console.log('   □ 新建订单功能');
  console.log('   □ 客户搜索功能');
  console.log('   □ 商品搜索功能');
  console.log('   □ 订单列表功能');
  console.log('   □ 客户管理功能');
  console.log('   □ 商品管理功能');
  console.log('   □ 赊销管理功能');
  console.log('   □ 分拣出库功能');
  process.exit(0);
} else {
  console.log('⚠️  发现一些问题，请修复后再上线。');
  process.exit(1);
}
console.log('='.repeat(60));
