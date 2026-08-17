/**
 * 原型对比分析脚本
 * 检查当前实现与原型设计的差异
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
const prototypePath = path.join(projectRoot, '原型/丰淮商贸采购下单助手_原型.html');

console.log('🔍 开始对比原型设计与当前实现...\n');

// 读取原型文件
const prototypeContent = fs.readFileSync(prototypePath, 'utf8');

// 提取原型中的关键样式
const stylePatterns = {
  '主绿色': /--green:\s*#([0-9A-Fa-f]{6})/,
  '橙色': /--orange:\s*#([0-9A-Fa-f]{6})/,
  '背景色': /--bg:\s*#([0-9A-Fa-f]{6})/,
  '文字主色': /--text:\s*#([0-9A-Fa-f]{6})/,
  '圆角': /--radius:\s*(\d+)rpx/,
};

console.log('📋 1. 颜色系统对比');
console.log('-'.repeat(40));

const prototypeColors = {
  '主绿色': '#06AD56',
  '橙色': '#FF6B35',
  '背景色': '#F5F6F8',
  '文字主色': '#333333',
};

for (const [name, color] of Object.entries(prototypeColors)) {
  console.log(`  原型 ${name}: ${color}`);
}

// 检查当前实现的颜色
console.log('\n📋 2. 检查当前实现的样式');
console.log('-'.repeat(40));

const mainWxss = fs.readFileSync(path.join(projectRoot, 'app.wxss'), 'utf8');

const colorChecks = [
  { name: '主绿色', pattern: /#06AD56|#07C160/, expected: '#06AD56' },
  { name: '橙色', pattern: /#FF6B35|#FF9A3D/, expected: '#FF6B35' },
  { name: '背景色', pattern: /#F5F6F8/, expected: '#F5F6F8' },
];

for (const check of colorChecks) {
  const found = check.pattern.test(mainWxss);
  console.log(`  ${check.name} (${check.expected}): ${found ? '✅ 已使用' : '❌ 未找到'}`);
}

// 检查关键组件
console.log('\n📋 3. 关键组件检查');
console.log('-'.repeat(40));

const components = [
  { name: '登录页 Hero', file: 'pages/login/login.wxml', pattern: /丰淮商贸/ },
  { name: 'TabBar', file: 'app.json', pattern: /tabBar/ },
  { name: '智能录入', file: 'pages/index/index.wxml', pattern: /智能录入/ },
  { name: '客户搜索', file: 'pages/new-order/new-order.wxml', pattern: /search|搜索/ },
  { name: '商品搜索', file: 'pages/new-order/new-order.wxml', pattern: /search|搜索/ },
];

for (const comp of components) {
  const filePath = path.join(projectRoot, comp.file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const found = comp.pattern.test(content);
    console.log(`  ${comp.name}: ${found ? '✅ 已实现' : '❌ 未找到'}`);
  } else {
    console.log(`  ${comp.name}: ❌ 文件不存在`);
  }
}

// 检查可能的 UI 问题
console.log('\n📋 4. 常见 UI 问题检查');
console.log('-'.repeat(40));

const uiIssues = [];

// 检查 TabBar 图标路径
const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
if (appJson.tabBar && appJson.tabBar.list) {
  for (const item of appJson.tabBar.list) {
    if (item.iconPath) {
      const iconPath = path.join(projectRoot, item.iconPath);
      if (!fs.existsSync(iconPath)) {
        uiIssues.push(`TabBar 图标缺失：${item.iconPath}`);
      }
    }
  }
}

// 检查 WXML 中的潜在问题
const pagesDir = path.join(projectRoot, 'pages');
for (const page of fs.readdirSync(pagesDir)) {
  const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
  if (!fs.existsSync(wxmlFile)) continue;
  
  const content = fs.readFileSync(wxmlFile, 'utf8');
  
  // 检查是否有未闭合的标签
  const openTags = (content.match(/<view/g) || []).length;
  const closeTags = (content.match(/<\/view>/g) || []).length;
  if (openTags !== closeTags) {
    uiIssues.push(`${page}.wxml: 标签不匹配 (${openTags} open, ${closeTags} close)`);
  }
}

if (uiIssues.length === 0) {
  console.log('  ✅ 未发现明显 UI 问题');
} else {
  for (const issue of uiIssues) {
    console.log(`  ❌ ${issue}`);
  }
}

// 生成差异报告
console.log('\n📋 5. 可能的问题点');
console.log('-'.repeat(40));

const potentialIssues = [
  {
    area: '登录页',
    check: '是否显示角色卡片选择',
    prototype: '无角色选择（微信一键登录）',
    action: '检查 login.wxml 是否有角色卡片代码'
  },
  {
    area: '首页',
    check: 'TabBar 图标是否显示',
    prototype: '5 个图标正常显示',
    action: '检查 app.json 和 assets/icons/'
  },
  {
    area: '新建订单',
    check: '客户/商品搜索是否工作',
    prototype: '搜索功能正常',
    action: '检查 new-order.js 中的搜索逻辑'
  },
  {
    area: '所有页面',
    check: '颜色是否与原型一致',
    prototype: '主绿 #06AD56，橙色 #FF6B35',
    action: '检查 app.wxss 中的颜色定义'
  },
  {
    area: '所有页面',
    check: '布局是否整齐',
    prototype: '整齐的卡片布局',
    action: '检查各页面的 wxss 样式'
  }
];

for (const issue of potentialIssues) {
  console.log(`\n  📍 ${issue.area}`);
  console.log(`     检查：${issue.check}`);
  console.log(`     原型：${issue.prototype}`);
  console.log(`     操作：${issue.action}`);
}

console.log('\n' + '='.repeat(60));
console.log('📝 建议');
console.log('='.repeat(60));
console.log('');
console.log('1. 请在微信开发者工具中实际运行小程序');
console.log('2. 逐个页面截图（登录、首页、新建订单等）');
console.log('3. 对照原型 HTML 文件（原型/丰淮商贸采购下单助手_原型.html）');
console.log('4. 找出具体差异点');
console.log('5. 截图发给我，我会精准修复');
console.log('');
console.log('常见"乱"的原因：');
console.log('  - 样式未加载（wxss 文件问题）');
console.log('  - 图标路径错误');
console.log('  - 数据未加载（云函数问题）');
console.log('  - WXML 结构错误');
console.log('  - 样式覆盖冲突');
console.log('');
console.log('📄 原型文件位置：原型/丰淮商贸采购下单助手_原型.html');
console.log('📄 可以浏览器打开查看完整设计');
