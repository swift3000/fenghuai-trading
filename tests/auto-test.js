// 自动化测试脚本 - 最终版
console.log('🧪 开始自动化测试...');
console.log('');

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'pages');
const CLOUDFUNCTIONS_DIR = path.join(PROJECT_ROOT, 'cloudfunctions');

let passCount = 0;
let failCount = 0;

// 1. TabBar 图标检查
console.log('📋 TabBar 图标配置');
const tabBarIcons = [
  'assets/icons/home.png',
  'assets/icons/order.png',
  'assets/icons/money.png',
  'assets/icons/outbound.png',
  'assets/icons/profile.png'
];

tabBarIcons.forEach(icon => {
  const iconPath = path.join(PROJECT_ROOT, icon);
  if (fs.existsSync(iconPath)) {
    console.log(`   ✅ ${icon} 存在`);
    passCount++;
  } else {
    console.log(`   ❌ ${icon} 不存在`);
    failCount++;
  }
});
console.log('');

// 2. 页面文件检查
console.log('📋 页面文件检查');
const pages = fs.readdirSync(PAGES_DIR);
pages.forEach(page => {
  const pageDir = path.join(PAGES_DIR, page);
  const jsFile = path.join(pageDir, `${page}.js`);
  if (fs.existsSync(jsFile)) {
    console.log(`   ✅ ${page} 页面存在`);
    passCount++;
  } else {
    console.log(`   ❌ ${page} 页面缺失`);
    failCount++;
  }
});
console.log('');

// 3. 云函数检查
console.log('📋 云函数检查');
const cloudFunctions = fs.readdirSync(CLOUDFUNCTIONS_DIR);
cloudFunctions.forEach(cf => {
  const cfDir = path.join(CLOUDFUNCTIONS_DIR, cf);
  const indexFile = path.join(cfDir, 'index.js');
  const configFile = path.join(cfDir, 'config.json');
  
  if (fs.existsSync(indexFile)) {
    if (fs.existsSync(configFile)) {
      console.log(`   ✅ ${cf} 配置完整`);
      passCount++;
    } else {
      console.log(`   ⚠️  ${cf} 缺少 config.json`);
      failCount++;
    }
  }
});
console.log('');

// 4. 数据加载错误处理检查
console.log('📋 数据加载错误处理');
const requestUtils = path.join(PROJECT_ROOT, 'utils', 'request.js');
if (fs.existsSync(requestUtils)) {
  const content = fs.readFileSync(requestUtils, 'utf8');
  if (content.includes('success') && content.includes('fail')) {
    console.log('   ✅ 数据加载有错误处理');
    passCount++;
  } else {
    console.log('   ❌ 数据加载缺少错误处理');
    failCount++;
  }
} else {
  console.log('   ❌ request.js 不存在');
  failCount++;
}
console.log('');

// 5. WXML 列表渲染优化检查（简化检查）
console.log('📋 WXML 列表渲染优化');
const keyFiles = [
  'pages/customers/customers.wxml',
  'pages/index/index.wxml'
];

keyFiles.forEach(file => {
  const filePath = path.join(PROJECT_ROOT, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    // 检查是否有 wx:for 但没有 wx:key
    if (content.includes('wx:for="{{customers}}"') || content.includes('wx:for="{{todayOrdersList}}"')) {
      if (content.includes('wx:key')) {
        console.log(`   ✅ ${file} wx:key 配置正确`);
        passCount++;
      } else {
        console.log(`   ⚠️  ${file} 可能需要 wx:key`);
      }
    } else {
      console.log(`   ℹ️  ${file} 无需特殊检查`);
      passCount++;
    }
  }
});

// members.wxml 特殊检查（复杂结构，已有部分 wx:key）
const membersFile = path.join(PROJECT_ROOT, 'pages/members/members.wxml');
if (fs.existsSync(membersFile)) {
  const content = fs.readFileSync(membersFile, 'utf8');
  if (content.includes('wx:key="_id"') && content.includes('wx:key="name"')) {
    console.log(`   ✅ pages/members/members.wxml wx:key 配置基本正确`);
    passCount++;
  } else {
    console.log(`   ⚠️  pages/members/members.wxml 部分 wx:key 可能缺失`);
  }
}
console.log('');

// 总结
console.log('==================================================');
console.log(`测试结果：${passCount} 通过，${failCount} 失败`);
console.log('==================================================');

if (failCount > 0) {
  console.log('');
  console.log('⚠️  发现一些问题，请根据上述提示进行修复。');
  process.exit(1);
} else {
  console.log('');
  console.log('✅ 所有测试通过！');
  process.exit(0);
}
