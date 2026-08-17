/**
 * 配置管理器
 * 统一管理测试配置、云函数配置、项目配置
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
const configPath = path.join(projectRoot, 'test-config.json');

const defaultConfig = {
  // 测试配置
  test: {
    skipPages: [],
    timeout: 30000,
    retryCount: 2,
    screenshotOnFailure: true,
    logLevel: 'info' // debug, info, warn, error
  },
  
  // 云函数配置
  cloudfunctions: {
    autoUpload: false,
    uploadAfterTest: true,
    env: 'auto-configured',
    timeout: 5,
    memory: 1024
  },
  
  // MCP 配置
  mcp: {
    enabled: true,
    autoStart: true,
    timeout: 30
  },
  
  // 页面测试配置
  pages: {
    'pages/login/login': {
      enabled: true,
      timeout: 10000,
      tests: ['login', 'logout']
    },
    'pages/index/index': {
      enabled: true,
      timeout: 15000,
      tests: ['view', 'navigate']
    }
  },
  
  // 最后更新时间
  lastUpdated: new Date().toISOString()
};

/**
 * 加载配置
 */
function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return defaultConfig;
}

/**
 * 保存配置
 */
function saveConfig(config) {
  config.lastUpdated = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}

/**
 * 初始化配置
 */
function initConfig() {
  if (!fs.existsSync(configPath)) {
    saveConfig(defaultConfig);
    console.log('✅ 已创建默认配置文件');
  }
  return loadConfig();
}

/**
 * 更新配置
 */
function updateConfig(updates) {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  return saveConfig(newConfig);
}

/**
 * 获取配置项
 */
function getConfig(key) {
  const config = loadConfig();
  return key ? key.split('.').reduce((obj, k) => obj?.[k], config) : config;
}

// CLI 接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      initConfig();
      console.log('配置文件位置:', configPath);
      break;

    case 'get':
      const key = args[1];
      console.log(JSON.stringify(getConfig(key), null, 2));
      break;

    case 'set':
      const [key, value] = args.slice(1);
      const updates = {};
      key.split('.').reduce((obj, k, i, arr) => {
        if (i === arr.length - 1) obj[k] = JSON.parse(value);
        else obj[k] = {};
        return obj[k];
      }, updates);
      console.log('更新:', JSON.stringify(updateConfig(updates), null, 2));
      break;

    case 'list':
      console.log(JSON.stringify(loadConfig(), null, 2));
      break;

    case 'reset':
      saveConfig(defaultConfig);
      console.log('✅ 配置已重置为默认值');
      break;

    default:
      console.log('配置管理器');
      console.log('');
      console.log('用法:');
      console.log('  node config-manager.js init          # 初始化配置');
      console.log('  node config-manager.js get <key>     # 获取配置项');
      console.log('  node config-manager.js set <key> <value>  # 设置配置项');
      console.log('  node config-manager.js list          # 列出所有配置');
      console.log('  node config-manager.js reset         # 重置配置');
      process.exit(1);
  }
}

module.exports = { loadConfig, saveConfig, initConfig, updateConfig, getConfig };
