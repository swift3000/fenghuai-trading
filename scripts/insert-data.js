#!/usr/bin/env node

/**
 * 数据插入脚本
 * 使用 CloudBase CLI 的 API 密钥认证插入数据
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const ENV_ID = 'cloud1-d6g75loi673b1e039';
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 手动加载.env 文件
const envPath = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const { CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY } = process.env;

if (!CLOUDBASE_SECRET_ID || !CLOUDBASE_SECRET_KEY) {
  console.error('❌ 缺少 API 密钥配置，请检查 .env 文件');
  process.exit(1);
}

// 登录
console.log('🔑 使用 API 密钥登录...');
try {
  execSync(`tcb login --apiKeyId ${CLOUDBASE_SECRET_ID} --apiKey ${CLOUDBASE_SECRET_KEY}`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  console.log('✅ 登录成功');
} catch (error) {
  console.error('❌ 登录失败');
  process.exit(1);
}

// 读取 JSON 文件
const regionsDataPath = path.join(__dirname, 'regions-data.json');
const regionsData = JSON.parse(fs.readFileSync(regionsDataPath, 'utf8'));

console.log('\n📍 插入 regions 数据...');
try {
  // 构造 MongoDB insert 命令 - 注意：这里使用双引号，内部双引号需要转义
  const mongoCommandObj = {
    insert: 'regions',
    documents: regionsData
  };
  
  // 将内部对象转为 JSON 字符串（这一步会处理所有转义）
  const mongoCommandStr = JSON.stringify(mongoCommandObj);
  
  // 构造完整的命令对象
  const commandObj = [{
    TableName: 'regions',
    CommandType: 'INSERT',
    Command: mongoCommandStr  // 这里已经是字符串了
  }];
  
  // 将整个命令对象转为 JSON
  const fullCommand = JSON.stringify(commandObj);
  
  // 使用 node 直接执行，避免 shell 转义问题
  const nodeScript = `
    const { execSync } = require('child_process');
    const cmd = \`tcb db nosql execute --database-name ${ENV_ID} --command '${fullCommand}'\`;
    console.log('Executing:', cmd.substring(0, 150) + '...');
    execSync(cmd, { stdio: 'inherit' });
  `;
  
  execSync(`node -e "${nodeScript}"`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  console.log('✅ regions 数据插入成功');
} catch (error) {
  console.error('❌ regions 数据插入失败:', error.message);
  process.exit(1);
}

// 初始化 system_config
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

console.log('\n⚙️  初始化 system_config...');
try {
  const mongoCommandObj = {
    insert: 'system_config',
    documents: [SYSTEM_CONFIG]
  };
  
  const mongoCommandStr = JSON.stringify(mongoCommandObj);
  
  const commandObj = [{
    TableName: 'system_config',
    CommandType: 'INSERT',
    Command: mongoCommandStr
  }];
  
  const fullCommand = JSON.stringify(commandObj);
  
  const nodeScript = `
    const { execSync } = require('child_process');
    const cmd = \`tcb db nosql execute --database-name ${ENV_ID} --command '${fullCommand}'\`;
    console.log('Executing:', cmd.substring(0, 150) + '...');
    execSync(cmd, { stdio: 'inherit' });
  `;
  
  execSync(`node -e "${nodeScript}"`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  console.log('✅ system_config 初始化成功');
} catch (error) {
  console.error('❌ system_config 初始化失败:', error.message);
  process.exit(1);
}

console.log('\n✅ 所有数据插入完成！');
