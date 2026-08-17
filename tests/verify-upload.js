/**
 * 验证云函数上传状态
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/Users/god/Desktop/项目/github/fenghuai-trading';
const CLOUDFUNCTIONS_DIR = path.join(PROJECT_ROOT, 'cloudfunctions');

console.log('========================================');
console.log('  ☁️  验证云函数上传状态');
console.log('========================================\n');

// 检查本地云函数
const localFunctions = fs.readdirSync(CLOUDFUNCTIONS_DIR)
  .filter(item => {
    const stat = fs.statSync(path.join(CLOUDFUNCTIONS_DIR, item));
    return stat.isDirectory() && fs.existsSync(path.join(CLOUDFUNCTIONS_DIR, item, 'index.js'));
  });

console.log('📋 本地云函数列表:');
localFunctions.forEach((func, i) => {
  console.log(`   ${i + 1}. ${func}`);
});

console.log(`\n✅ 共 ${localFunctions.length} 个云函数\n`);

// 生成验证清单
const requiredFunctions = [
  'auth',
  'check-customer-fields',
  'clear-all-data',
  'customers',
  'import-data',
  'init-db',
  'orders',
  'outbound',
  'products',
  'receivable',
  'regions',
  'report',
  'smart',
  'system',
  'users'
];

console.log('📋 验证清单:');
requiredFunctions.forEach(func => {
  const exists = localFunctions.includes(func);
  console.log(`   ${exists ? '✅' : '❌'} ${func}`);
});

console.log('\n========================================');
console.log('📊 下一步操作');
console.log('========================================\n');

console.log('1️⃣ 初始化数据库集合');
console.log('   在小程序中调用 init-db 云函数');
console.log('   或在云开发控制台手动创建 5 个集合:\n');
console.log('   - users');
console.log('   - orders');
console.log('   - products');
console.log('   - customers');
console.log('   - receivable\n');

console.log('2️⃣ 编译并测试小程序');
console.log('   点击"编译"按钮，查看控制台日志\n');

console.log('3️⃣ 测试登录功能');
console.log('   点击"微信一键登录"，验证是否能成功登录\n');

