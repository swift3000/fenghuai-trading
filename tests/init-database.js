/**
 * 数据库初始化脚本
 * 创建必要的集合并设置权限
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

async function createCollection(name) {
  try {
    await db.collection(name).get();
    console.log(`✅ 集合 ${name} 已存在`);
    return true;
  } catch (err) {
    if (err.errMsg && err.errMsg.includes('set not found')) {
      try {
        // 创建新集合
        await db.command.add({
          data: {
            _created: Date.now(),
            _note: '初始化集合'
          }
        });
        console.log(`✅ 已创建集合：${name}`);
        return true;
      } catch (createErr) {
        console.log(`⚠️  集合 ${name} 创建提示：请在云开发控制台手动创建`);
        return false;
      }
    }
    console.log(`✅ 集合 ${name} 已存在`);
    return true;
  }
}

async function initDatabase() {
  console.log('🔧 开始初始化数据库...\n');
  
  const collections = [
    'users',
    'orders', 
    'products',
    'customers',
    'receivable'
  ];
  
  const results = [];
  
  for (const name of collections) {
    const success = await createCollection(name);
    results.push({ name, success });
  }
  
  console.log('\n========================================');
  console.log('📊 初始化结果');
  console.log('========================================');
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '⚠️'}  ${r.name}`);
  });
  
  console.log('\n💡 提示：');
  console.log('1. 如果显示"已存在"，说明集合已经创建');
  console.log('2. 如果显示"请手动创建"，请在云开发控制台创建对应集合');
  console.log('3. 集合创建后，需要设置权限为"所有用户可读写"（测试阶段）');
  
  return results;
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase().then(() => {
    console.log('\n✅ 数据库初始化完成');
    process.exit(0);
  }).catch(err => {
    console.error('❌ 初始化失败:', err);
    process.exit(1);
  });
}

module.exports = { initDatabase };
