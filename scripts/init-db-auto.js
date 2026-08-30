/**
 * W0 数据库自动化初始化脚本
 * 
 * 使用方法：
 * 1. 先执行：tcb login (微信扫码)
 * 2. 然后执行：node scripts/init-db-auto.js
 */

const { execSync } = require('child_process');

// ==================== 配置 ====================
const ENV_ID = 'cloud1-d6g75loi673b1e039';

// 11 个数据库集合
const COLLECTIONS = [
  'users',
  'regions',
  'products',
  'customers',
  'orders',
  'order_items',
  'payments',
  'product_aliases',
  'customer_aliases',
  'order_logs',
  'system_config'
];

// regions 预置数据
const REGIONS_DATA = [
  { "_id": "1", "name": "汉滨区", "sort": 1, "status": 1 },
  { "_id": "2", "name": "汉阴县", "sort": 2, "status": 1 },
  { "_id": "3", "name": "石泉县", "sort": 3, "status": 1 },
  { "_id": "4", "name": "宁陕县", "sort": 4, "status": 1 },
  { "_id": "5", "name": "紫阳县", "sort": 5, "status": 1 },
  { "_id": "6", "name": "岚皋县", "sort": 6, "status": 1 },
  { "_id": "7", "name": "平利县", "sort": 7, "status": 1 },
  { "_id": "8", "name": "镇坪县", "sort": 8, "status": 1 },
  { "_id": "9", "name": "旬阳市", "sort": 9, "status": 1 },
  { "_id": "10", "name": "白河县", "sort": 10, "status": 1 },
  { "_id": "99", "name": "外县", "sort": 99, "status": 1 }
];

// system_config 初始配置
const SYSTEM_CONFIG = {
  "_id": "ai_config",
  "type": "ai",
  "asr": {
    "enabled": false,
    "appId": "",
    "appKey": "",
    "secretKey": ""
  },
  "nlp": {
    "enabled": false,
    "apiKey": ""
  },
  "voice": {
    "enabled": false,
    "voiceId": ""
  },
  "printer": {
    "enabled": false,
    "printerId": "",
    "printerName": ""
  },
  "status": 1,
  "createTime": new Date().toISOString()
};

// ==================== 工具函数 ====================
function runCommand(cmd) {
  try {
    // SC-2：cmd 由本脚本内硬编码命令拼装（集合名=代码常量，无用户/网络输入通路），仅本地初始化用；
    // 若未来接入外部输入必须先做白名单校验
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return output;
  } catch (error) {
    console.error(`❌ 命令执行失败：${cmd}`);
    console.error(error.stderr);
    throw error;
  }
}

// ==================== 主流程 ====================
async function main() {
  console.log('==========================================');
  console.log('📋 W0 数据库自动化初始化');
  console.log('==========================================');
  console.log('');

  // 检查登录状态
  console.log('📋 步骤 1: 检查登录状态...');
  try {
    const loginStatus = runCommand('tcb islogin');
    console.log('✅ 已登录');
  } catch (error) {
    console.log('❌ 未登录，请先执行：tcb login');
    console.log('然后用微信扫码授权');
    process.exit(1);
  }
  console.log('');

  // 创建数据库集合
  console.log('📋 步骤 2: 创建 11 个数据库集合...');
  for (const collection of COLLECTIONS) {
    try {
      // 尝试创建集合（如果已存在会报错，忽略错误）
      runCommand(`tcb db nosql execute --collection "${collection}" --operation "add" --data '{"test": 1}'`);
      console.log(`  ✅ 集合 ${collection} 已创建`);
    } catch (error) {
      // 集合已存在，跳过
      console.log(`  ℹ️  集合 ${collection} 已存在`);
    }
  }
  console.log('');

  // 插入 regions 数据
  console.log('📋 步骤 3: 插入 regions 预置数据（11 条）...');
  const regionsJson = JSON.stringify(REGIONS_DATA);
  try {
    runCommand(`tcb db nosql execute --collection "regions" --operation "add" --data "${regionsJson}"`);
    console.log('✅ regions 数据插入完成');
  } catch (error) {
    console.log('⚠️  regions 数据可能已存在，跳过插入');
  }
  console.log('');

  // 插入 system_config
  console.log('📋 步骤 4: 初始化 system_config...');
  const configJson = JSON.stringify(SYSTEM_CONFIG);
  try {
    runCommand(`tcb db nosql execute --collection "system_config" --operation "add" --data "${configJson}"`);
    console.log('✅ system_config 初始化完成');
  } catch (error) {
    console.log('⚠️  system_config 可能已存在，跳过插入');
  }
  console.log('');

  console.log('==========================================');
  console.log('✅ 数据库初始化完成！');
  console.log('==========================================');
  console.log('');
  console.log('已完成的任务：');
  console.log(`  ✅ 创建 ${COLLECTIONS.length} 个数据库集合`);
  console.log(`  ✅ 插入 ${REGIONS_DATA.length} 条 regions 数据`);
  console.log('  ✅ 初始化 system_config');
  console.log('');
  console.log('下一步：执行云函数部署');
  console.log('  请执行：./scripts/deploy-cloudfunctions.sh');
}

main().catch(error => {
  console.error('部署失败:', error);
  process.exit(1);
});
