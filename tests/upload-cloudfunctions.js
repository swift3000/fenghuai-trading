/**
 * 云函数自动上传脚本
 * 测试通过后自动上传所有云函数
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';
const cloudfunctionsDir = path.join(projectRoot, 'cloudfunctions');

// 需要上传的云函数列表
const functionsToUpload = [
  'auth',
  'check-customer-fields',
  'clear-all-data',
  'customers',
  'import-data',
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

// 微信开发者工具 CLI 路径
const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const APPID = 'wxe4ab72773abd200f';

/**
 * 检查云函数是否已部署（简化版，直接返回未部署）
 */
function checkFunctionDeployed(funcName) {
  // 暂时假设都未部署，直接上传
  return false;
}

/**
 * 上传单个云函数
 */
function uploadFunction(funcName) {
  const funcPath = path.join(cloudfunctionsDir, funcName);
  
  if (!fs.existsSync(funcPath)) {
    console.error(`❌ 云函数不存在：${funcName}`);
    return false;
  }

  // 检查 config.json 是否存在，不存在则创建
  const configPath = path.join(funcPath, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      "timeout": 5,
      "env": "scf-xxxxx" // 替换为实际环境
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`📝 已创建 config.json: ${funcName}`);
  }

  // 检查 package.json 是否存在
  const pkgPath = path.join(funcPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const defaultPkg = {
      "name": funcName,
      "version": "1.0.0",
      "dependencies": {
        "wx-server-sdk": "~2.6.3"
      }
    };
    fs.writeFileSync(pkgPath, JSON.stringify(defaultPkg, null, 2));
    console.log(`📝 已创建 package.json: ${funcName}`);
  }

  console.log(`📤 正在上传云函数：${funcName}`);
  
  try {
    // 使用微信开发者工具 CLI 上传
    const result = execSync(
      `"${CLI_PATH}" --project "${projectRoot}" --appid ${APPID} cloud functions upload --name ${funcName}`,
      { 
        encoding: 'utf8',
        timeout: 120000,
        stdio: 'pipe'
      }
    );
    
    console.log(`✅ 上传成功：${funcName}`);
    return true;
  } catch (error) {
    // CLI 可能返回帮助信息而不是错误，尝试其他方式
    console.log(`⚠️  CLI 上传失败，尝试使用 npm 方式: ${funcName}`);
    
    // 尝试使用微信开发者工具的 npm 方式
    try {
      execSync(
        `"${CLI_PATH}" --project "${projectRoot}" --appid ${APPID} cloud functions use-environment`,
        { encoding: 'utf8', timeout: 30000 }
      );
      console.log(`ℹ️  环境选择完成：${funcName}`);
    } catch (e) {
      console.log(`ℹ️  环境选择跳过：${funcName}`);
    }
    
    return false;
  }
}

/**
 * 批量上传云函数
 */
async function uploadAllFunctions(options = {}) {
  const {
    onlyFailed = false,
    specificFunctions = []
  } = options;

  let functionsToProcess = specificFunctions.length > 0 
    ? specificFunctions 
    : functionsToUpload;

  const results = {
    success: [],
    failed: [],
    skipped: [],
    configCreated: []
  };

  for (const funcName of functionsToProcess) {
    const funcPath = path.join(cloudfunctionsDir, funcName);
    
    // 检查是否需要创建配置
    const configPath = path.join(funcPath, 'config.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        "timeout": 5,
        "env": "auto-configured"
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      results.configCreated.push(funcName);
    }
    
    const success = uploadFunction(funcName);
    if (success) {
      results.success.push(funcName);
    } else {
      results.failed.push(funcName);
    }
  }

  // 生成上传报告
  const report = {
    timestamp: new Date().toISOString(),
    total: functionsToProcess.length,
    success: results.success.length,
    failed: results.failed.length,
    configCreated: results.configCreated.length,
    details: results
  };

  const reportPath = path.join(projectRoot, '云函数上传报告.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 上传报告已保存：${reportPath}`);

  return report;
}

// CLI 接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'upload-all':
      console.log('📤 上传所有云函数...\n');
      uploadAllFunctions()
        .then(report => {
          console.log('\n========== 上传总结 ==========');
          console.log(`成功：${report.success.length}`);
          console.log(`失败：${report.failed.length}`);
          console.log(`创建配置：${report.configCreated.length}`);
          if (report.failed.length > 0) {
            console.log(`失败列表: ${report.failed.join(', ')}`);
          }
          console.log('=============================\n');
        })
        .catch(err => {
          console.error('上传失败:', err);
          process.exit(1);
        });
      break;

    case 'upload-failed':
      console.log('📤 上传未部署的云函数...\n');
      uploadAllFunctions({ onlyFailed: true })
        .then(report => {
          console.log('\n========== 上传总结 ==========');
          console.log(`成功：${report.success.length}`);
          console.log(`失败：${report.failed.length}`);
          console.log(`创建配置：${report.configCreated.length}`);
          if (report.failed.length > 0) {
            console.log(`失败列表: ${report.failed.join(', ')}`);
          }
          console.log('=============================\n');
        })
        .catch(err => {
          console.error('上传失败:', err);
          process.exit(1);
        });
      break;

    case 'check-deployed':
      console.log('🔍 检查云函数部署状态...\n');
      console.log('注意：CLI 命令格式问题，暂时假设所有云函数都未部署');
      console.log('建议手动在微信开发者工具中上传云函数\n');
      functionsToUpload.forEach(fn => {
        console.log(`${fn}: ❌ 未部署（建议手动上传）`);
      });
      break;

    case 'create-config':
      console.log('📝 创建缺失的云函数配置...\n');
      let count = 0;
      functionsToUpload.forEach(fn => {
        const funcPath = path.join(cloudfunctionsDir, fn);
        if (fs.existsSync(funcPath)) {
          const configPath = path.join(funcPath, 'config.json');
          if (!fs.existsSync(configPath)) {
            const defaultConfig = {
              "timeout": 5,
              "env": "auto-configured"
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`✅ 已创建 config.json: ${fn}`);
            count++;
          }
          
          const pkgPath = path.join(funcPath, 'package.json');
          if (!fs.existsSync(pkgPath)) {
            const defaultPkg = {
              "name": fn,
              "version": "1.0.0",
              "dependencies": {
                "wx-server-sdk": "~2.6.3"
              }
            };
            fs.writeFileSync(pkgPath, JSON.stringify(defaultPkg, null, 2));
            console.log(`✅ 已创建 package.json: ${fn}`);
          }
        }
      });
      console.log(`\n✅ 共创建 ${count} 个配置文件`);
      break;

    default:
      console.log('云函数上传工具');
      console.log('');
      console.log('用法:');
      console.log('  node upload-cloudfunctions.js upload-all          # 上传所有云函数');
      console.log('  node upload-cloudfunctions.js upload-failed       # 仅上传未部署的');
      console.log('  node upload-cloudfunctions.js check-deployed      # 检查部署状态');
      console.log('  node upload-cloudfunctions.js create-config       # 创建缺失的配置');
      process.exit(1);
  }
}

module.exports = { uploadAllFunctions, checkFunctionDeployed, uploadFunction };
