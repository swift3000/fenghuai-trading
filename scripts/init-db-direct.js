#!/usr/bin/env node

/**
 * 直接初始化数据库脚本
 * 使用 tcb SDK 直接操作数据库
 */

const tcb = require('@cloudbase/node-sdk');
const fs = require('fs');
const path = require('path');

// 配置
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 手动加载.env 文件
const envPath = path.join(PROJECT_ROOT, '.env');
let envConfig = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envConfig[key.trim()] = value.trim();
    }
  });
}

const { CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY, CLOUDBASE_ENV_ID } = envConfig;

if (!CLOUDBASE_SECRET_ID || !CLOUDBASE_SECRET_KEY) {
  console.error('❌ 缺少 API 密钥配置，请检查 .env 文件');
  process.exit(1);
}

// 初始化 SDK
const app = tcb.init({
  env: CLOUDBASE_ENV_ID,
  secretId: CLOUDBASE_SECRET_ID,
  secretKey: CLOUDBASE_SECRET_KEY
});

const db = app.database();

// 创建集合
async function createCollections() {
  console.log('\n📋 创建数据库集合...');
  const collections = [
    'users', 'regions', 'products', 'customers', 'orders', 
    'order_items', 'payments', 'product_aliases', 
    'customer_aliases', 'order_logs', 'system_config'
  ];
  
  for (const name of collections) {
    try {
      // 检查集合是否存在
      const result = await db.collection(name).get();
      console.log(`  ✅ ${name} 已存在`);
    } catch (err) {
      if (err.code === 'DATABASE_COLLECTION_NOT_EXIST') {
        // 集合不存在，创建它（通过插入一条数据）
        await db.collection(name).add({
          data: {
            _id: 'init_placeholder',
            status: 1,
            createdAt: new Date()
          }
        });
        // 删除占位符
        await db.collection(name).doc('init_placeholder').remove();
        console.log(`  ✅ ${name} 创建成功`);
      } else {
        console.log(`  ⚠️  ${name}: ${err.message}`);
      }
    }
  }
}

// 插入 regions 数据
async function insertRegionsData() {
  console.log('\n📍 插入 regions 数据...');
  
  const regionsDataPath = path.join(__dirname, 'regions-data.json');
  const regionsData = JSON.parse(fs.readFileSync(regionsDataPath, 'utf8'));
  
  let successCount = 0;
  for (const region of regionsData) {
    try {
      await db.collection('regions').add({
        data: region
      });
      successCount++;
      console.log(`  ✅ ${region.name}`);
    } catch (err) {
      if (err.code === 'DATABASE_DOCUMENT_DUPLICATE_KEY') {
        console.log(`  ⚠️  ${region.name} 已存在，跳过`);
      } else {
        console.log(`  ❌ ${region.name}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n  成功插入 ${successCount}/${regionsData.length} 条数据`);
}

// 初始化 system_config
async function initSystemConfig() {
  console.log('\n⚙️  初始化 system_config...');
  
  const SYSTEM_CONFIG = {
    _id: 'ai_config',
    type: 'ai',
    asr: { enabled: false, appId: '', appKey: '', secretKey: '' },
    nlp: { enabled: false, apiKey: '' },
    voice: { enabled: false, voiceId: '' },
    printer: { enabled: false, printerId: '', printerName: '' },
    status: 1,
    createTime: new Date().toISOString()
  };
  
  try {
    await db.collection('system_config').add({
      data: SYSTEM_CONFIG
    });
    console.log('  ✅ system_config 初始化成功');
  } catch (err) {
    if (err.code === 'DATABASE_DOCUMENT_DUPLICATE_KEY') {
      console.log('  ⚠️  system_config 已存在，跳过');
    } else {
      console.log(`  ❌ system_config: ${err.message}`);
    }
  }
}

// 主函数
async function main() {
  console.log('==========================================');
  console.log('🚀 丰淮商贸小程序 · 数据库初始化');
  console.log('==========================================');
  
  try {
    await createCollections();
    await insertRegionsData();
    await initSystemConfig();
    
    console.log('\n==========================================');
    console.log('✅ 数据库初始化完成！');
    console.log('==========================================\n');
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
