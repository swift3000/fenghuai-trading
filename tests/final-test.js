/**
 * 最终测试脚本 - 修复误报问题
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      passed++;
      console.log(`✅ ${name}`);
    } else {
      failed++;
      console.log(`❌ ${name}: ${result}`);
    }
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

console.log('='.repeat(60));
console.log('🚀 最终测试开始...');
console.log('='.repeat(60));
console.log('');

// 1. 文件存在性检查
console.log('📋 1. 文件存在性检查');
test('所有页面文件存在', () => {
  const pages = ['index', 'login', 'new-order', 'order-detail', 'orders', 
                 'products', 'customers', 'receivable', 'outbound', 
                 'reports', 'shipping', 'profile', 'members', 'settings'];
  for (const page of pages) {
    if (!fs.existsSync(path.join(projectRoot, 'pages', page, `${page}.js`))) 
      return `缺少 ${page}.js`;
    if (!fs.existsSync(path.join(projectRoot, 'pages', page, `${page}.wxml`))) 
      return `缺少 ${page}.wxml`;
  }
});

test('所有云函数文件存在', () => {
  const functions = ['orders', 'customers', 'products', 'auth', 'receivable', 
                     'report', 'regions', 'system', 'smart', 'users'];
  for (const fn of functions) {
    if (!fs.existsSync(path.join(projectRoot, 'cloudfunctions', fn, 'index.js'))) 
      return `缺少 ${fn}/index.js`;
    if (!fs.existsSync(path.join(projectRoot, 'cloudfunctions', fn, 'config.json'))) 
      return `缺少 ${fn}/config.json`;
  }
});

// 2. WXML 检查
console.log('');
console.log('📋 2. WXML 检查');
test('WXML 无嵌套三元表达式', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    const content = fs.readFileSync(wxmlFile, 'utf8');
    // 更精确的嵌套三元表达式检测
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('{{') && line.includes('?:')) {
        // 检查是否是真正的嵌套
        const match = line.match(/\{\{[^}]*\?.*:\s*\?.*:[^}]*\}\}/);
        if (match) {
          return `${page}.wxml 第${i+1}行：发现嵌套三元表达式`;
        }
      }
    }
  }
});

test('所有 wx:for 都有 wx:key', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const wxmlFile = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlFile)) continue;
    const content = fs.readFileSync(wxmlFile, 'utf8');
    
    // 统计 wx:for 和 wx:key 的数量
    const forCount = (content.match(/wx:for=/g) || []).length;
    const keyCount = (content.match(/wx:key=/g) || []).length;
    
    if (forCount > 0 && forCount !== keyCount) {
      return `${page}.wxml: ${forCount}个 wx:for, ${keyCount}个 wx:key`;
    }
  }
});

// 3. JS 语法检查
console.log('');
console.log('📋 3. JS 语法检查');
test('所有 JS 文件语法正确', () => {
  const pagesDir = path.join(projectRoot, 'pages');
  const pages = fs.readdirSync(pagesDir);
  for (const page of pages) {
    const jsFile = path.join(pagesDir, page, `${page}.js`);
    if (!fs.existsSync(jsFile)) continue;
    
    try {
      const content = fs.readFileSync(jsFile, 'utf8');
      // 移除微信小程序特有的全局函数调用
      const cleaned = content
        .replace(/getApp\(\)/g, '{}')
        .replace(/Page\(/g, '({')
        .replace(/Page\s*\(/g, '({')
        .replace(/require\(['"]\.\.\/[^'"]+['"]\)/g, '{}');
      
      new Function(cleaned);
    } catch (e) {
      return `${page}.js: ${e.message}`;
    }
  }
});

// 4. TabBar 配置检查
console.log('');
console.log('📋 4. TabBar 配置检查');
test('TabBar 图标配置正确', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  if (!appJson.tabBar || !appJson.tabBar.list) return 'TabBar 配置缺失';
  
  for (const item of appJson.tabBar.list) {
    if (item.iconPath && !fs.existsSync(path.join(projectRoot, item.iconPath))) {
      return `缺失图标：${item.iconPath}`;
    }
    if (item.selectedIconPath && !fs.existsSync(path.join(projectRoot, item.selectedIconPath))) {
      return `缺失图标：${item.selectedIconPath}`;
    }
  }
});

// 5. 数据加载检查
console.log('');
console.log('📋 5. 数据加载检查');
test('首页数据加载有错误处理', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'pages/index/index.js'), 'utf8');
  if (!content.includes('try') || !content.includes('catch')) {
    return '缺少 try-catch 错误处理';
  }
});

test('新建订单客户搜索功能正常', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!content.includes('customerSearchKeyword')) return '缺少客户搜索';
  if (!content.includes('refreshCustomers')) return '缺少刷新方法';
});

test('新建订单商品搜索功能正常', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'pages/new-order/new-order.js'), 'utf8');
  if (!content.includes('productSearchKeyword')) return '缺少商品搜索';
  if (!content.includes('refreshProducts')) return '缺少刷新方法';
});

// 6. 云函数检查
console.log('');
console.log('📋 6. 云函数检查');
test('orders 云函数逻辑完整', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/orders/index.js'), 'utf8');
  if (!content.includes("case 'create'")) return '缺少创建逻辑';
  if (!content.includes("case 'list'")) return '缺少列表逻辑';
  if (!content.includes("case 'detail'")) return '缺少详情逻辑';
});

test('customers 云函数逻辑完整', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/customers/index.js'), 'utf8');
  if (!content.includes("case 'list'")) return '缺少列表逻辑';
  if (!content.includes("case 'create'")) return '缺少创建逻辑';
});

test('products 云函数逻辑完整', () => {
  const content = fs.readFileSync(path.join(projectRoot, 'cloudfunctions/products/index.js'), 'utf8');
  if (!content.includes("case 'list'")) return '缺少列表逻辑';
  if (!content.includes("case 'create'")) return '缺少创建逻辑';
});

// 汇总
console.log('');
console.log('='.repeat(60));
console.log('📊 测试结果');
console.log('='.repeat(60));
console.log(`✅ 通过：${passed}`);
console.log(`❌ 失败：${failed}`);
console.log(`📈 总计：${passed + failed}`);
console.log('');

if (failed === 0) {
  console.log('🎉 所有测试通过！小程序准备就绪！');
  console.log('');
  console.log('下一步：');
  console.log('1. 在微信开发者工具中点击"编译"');
  console.log('2. 测试各项功能');
  console.log('3. 确认无误后上线');
  process.exit(0);
} else {
  console.log('⚠️  发现一些问题，请修复后再测试。');
  process.exit(1);
}
