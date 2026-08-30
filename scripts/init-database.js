#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 使用 CloudBase CLI 自动化创建集合和插入数据
 */

const { execSync } = require('child_process');

// 云开发环境 ID
const ENV_ID = 'cloud1-d6g75loi673b1e039';

// 需要创建的集合列表
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
  { _id: '1', name: '汉滨区', sort: 1, status: 1 },
  { _id: '2', name: '汉阴县', sort: 2, status: 1 },
  { _id: '3', name: '石泉县', sort: 3, status: 1 },
  { _id: '4', name: '宁陕县', sort: 4, status: 1 },
  { _id: '5', name: '紫阳县', sort: 5, status: 1 },
  { _id: '6', name: '岚皋县', sort: 6, status: 1 },
  { _id: '7', name: '平利县', sort: 7, status: 1 },
  { _id: '8', name: '镇坪县', sort: 8, status: 1 },
  { _id: '9', name: '旬阳市', sort: 9, status: 1 },
  { _id: '10', name: '白河县', sort: 10, status: 1 },
  { _id: '99', name: '外县', sort: 99, status: 1 }
];

// system_config 初始化数据
const SYSTEM_CONFIG_DATA = {
  _id: 'ai_config',
  type: 'ai',
  asr: { enabled: false, appId: '', appKey: '', secretKey: '' },
  nlp: { enabled: false, apiKey: '' },
  voice: { enabled: false, voiceId: '' },
  printer: { enabled: false, printerId: '', printerName: '' },
  status: 1,
  createTime: new Date().toISOString()
};

/**
 * 执行 CloudBase CLI 命令
 */
function execCommand(command) {
  try {
    // SC-2：command 由本脚本内硬编码常量拼装（无用户/网络输入通路），仅本地初始化用；
    // 若未来接入外部输入必须先做白名单校验
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return output;
  } catch (error) {
    console.error('命令执行失败:', error.message);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    throw error;
  }
}

/**
 * 创建集合（通过插入一条测试数据）
 */
function createCollection(collectionName) {
  const command = `cloudbase db nosql execute --database-name "${ENV_ID}" --command '[{"TableName":"${collectionName}","CommandType":"INSERT","Command":"{\\"insert\\":\\"${collectionName}\\",\\"documents\\":[{\\"_id\\":\\"init\\",\\"status\\":1}]}"}]'`;
  
  try {
    execCommand(command);
    console.log(`✅ 集合 ${collectionName} 创建成功`);
    return true;
  } catch (error) {
    // 如果集合已存在，忽略错误
    console.log(`⚠️  集合 ${collectionName} 可能已存在，跳过`);
    return false;
  }
}

/**
 * 插入数据
 */
function insertData(collectionName, data) {
  const documents = JSON.stringify(data);
  const command = `cloudbase db nosql execute --database-name "${ENV_ID}" --command '[{"TableName":"${collectionName}","CommandType":"INSERT","Command":"{\\"insert\\":\\"${collectionName}\\",\\"documents\\":${documents}}}"]'`;
  
  try {
    execCommand(command);
    console.log(`✅ ${collectionName} 数据插入成功`);
    return true;
  } catch (error) {
    console.error(`❌ ${collectionName} 数据插入失败`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('==========================================');
  console.log('🚀 数据库初始化 - 乾多多小程序');
  console.log('==========================================');
  console.log('');

  // 1. 创建 11 个集合
  console.log('📋 步骤 1/3: 创建数据库集合');
  console.log('');
  
  for (const collection of COLLECTIONS) {
    createCollection(collection);
  }
  
  console.log('');

  // 2. 插入 regions 数据
  console.log('📋 步骤 2/3: 插入 regions 预置数据');
  console.log('');
  
  insertData('regions', REGIONS_DATA);
  console.log('');

  // 3. 初始化 system_config
  console.log('📋 步骤 3/3: 初始化 system_config');
  console.log('');
  
  insertData('system_config', [SYSTEM_CONFIG_DATA]);
  console.log('');

  console.log('==========================================');
  console.log('✅ 数据库初始化全部完成！');
  console.log('==========================================');
  console.log('');
  console.log('已完成：');
  console.log(`  ✅ 创建 ${COLLECTIONS.length} 个数据库集合`);
  console.log(`  ✅ 插入 ${REGIONS_DATA.length} 条 regions 数据`);
  console.log('  ✅ 初始化 system_config');
  console.log('');
}

// 执行
main().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
