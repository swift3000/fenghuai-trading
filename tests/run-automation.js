const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/god/Desktop/项目/github/fenghuai-trading';
const REPORT_DIR = path.join(PROJECT_PATH, 'tests/reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// 确保报告目录存在
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

console.log('==========================================');
console.log('  微信小程序全自动化测试');
console.log('==========================================');
console.log(`项目路径：${PROJECT_PATH}`);
console.log(`报告目录：${REPORT_DIR}`);
console.log(`时间戳：${TIMESTAMP}`);
console.log('');

async function runAutomation() {
  try {
    // 1. 检查环境
    console.log('📋 步骤 1: 检查环境');
    const status = execSync('wechat_ide_status', { encoding: 'utf8' });
    console.log(status);
    
    // 2. 打开项目
    console.log('📱 步骤 2: 打开小程序项目');
    const openResult = execSync(`wechat_open "${PROJECT_PATH}"`, { encoding: 'utf8' });
    console.log(openResult);
    await delay(2000);
    
    // 3. 编译项目
    console.log('🔨 步骤 3: 编译项目');
    const compileResult = execSync('wechat_compile', { encoding: 'utf8' });
    console.log(compileResult);
    await delay(3000);
    
    // 4. 截图登录页
    console.log('📸 步骤 4: 截图登录页面');
    const loginScreenshot = path.join(REPORT_DIR, `login_${TIMESTAMP}.png`);
    const loginResult = execSync(`wechat_screenshot "${loginScreenshot}"`, { encoding: 'utf8' });
    console.log(loginResult);
    
    // 5. 点击登录按钮
    console.log('🔐 步骤 5: 执行登录');
    const loginClick = execSync('wechat_click "#login-button"', { encoding: 'utf8' });
    console.log(loginClick);
    await delay(3000);
    
    // 6. 截图首页
    console.log('📸 步骤 6: 截图首页');
    const homeScreenshot = path.join(REPORT_DIR, `home_${TIMESTAMP}.png`);
    const homeResult = execSync(`wechat_screenshot "${homeScreenshot}"`, { encoding: 'utf8' });
    console.log(homeResult);
    
    // 7. 获取控制台日志
    console.log('📋 步骤 7: 获取控制台日志');
    const consoleLog = execSync('wechat_console', { encoding: 'utf8' });
    const logFile = path.join(REPORT_DIR, `console_log_${TIMESTAMP}.txt`);
    fs.writeFileSync(logFile, consoleLog);
    console.log(`✅ 日志已保存到：${logFile}`);
    
    console.log('');
    console.log('==========================================');
    console.log('  ✅ 自动化测试完成');
    console.log('==========================================');
    console.log(`生成的文件:`);
    const files = fs.readdirSync(REPORT_DIR).filter(f => f.includes(TIMESTAMP));
    files.forEach(f => console.log(`  - ${f}`));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stdout?.toString());
    console.error(error.stderr?.toString());
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runAutomation();
