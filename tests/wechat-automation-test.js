// 使用 wechat-devtools-mcp 进行自动化测试
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
console.log('  微信小程序自动化测试');
console.log('  使用 wechat-devtools-mcp');
console.log('==========================================');
console.log(`项目路径：${PROJECT_PATH}`);
console.log(`报告目录：${REPORT_DIR}`);
console.log(`时间戳：${TIMESTAMP}`);
console.log('');

// 由于 MCP 工具不能直接在 shell 中调用，我们创建一个测试计划文件
const testPlan = `# 微信自动化测试计划

**时间**: ${new Date().toISOString()}
**项目**: fenghuai-trading

## MCP 工具列表

可用的 wechat-devtools-mcp 工具：
- wechat_ide_status() - 检查环境状态
- wechat_open() - 打开小程序项目
- wechat_compile() - 编译项目
- wechat_screenshot() - 页面截图
- wechat_console() - 获取控制台日志
- wechat_scroll() - 滚动页面
- wechat_click() - 点击元素

## 测试步骤

### 1. 检查环境
\`\`\`
wechat_ide_status()
\`\`\`

### 2. 打开项目
\`\`\`
wechat_open("${PROJECT_PATH}")
\`\`\`

### 3. 编译项目
\`\`\`
wechat_compile()
\`\`\`

### 4. 截图登录页
\`\`\`
wechat_screenshot("${REPORT_DIR}/login_${TIMESTAMP}.png")
\`\`\`

### 5. 点击登录
\`\`\`
wechat_click("button.wechat-login-btn")
\`\`\`

### 6. 截图首页
\`\`\`
wechat_screenshot("${REPORT_DIR}/home_${TIMESTAMP}.png")
\`\`\`

### 7. 测试新建订单
\`\`\`
wechat_click("button.new-order-btn")
wechat_click(".customer-selector")
wechat_click(".customer-item:first-child")
wechat_click(".add-product-btn")
wechat_click(".product-item:first-child")
wechat_type("1")
wechat_click(".submit-order-btn")
wechat_screenshot("${REPORT_DIR}/new_order_${TIMESTAMP}.png")
\`\`\`

### 8. 测试订单列表
\`\`\`
wechat_click(".tab-orders")
wechat_screenshot("${REPORT_DIR}/orders_${TIMESTAMP}.png")
\`\`\`

### 9. 测试商品管理
\`\`\`
wechat_click(".tab-products")
wechat_screenshot("${REPORT_DIR}/products_${TIMESTAMP}.png")
\`\`\`

### 10. 测试客户管理
\`\`\`
wechat_click(".tab-customers")
wechat_screenshot("${REPORT_DIR}/customers_${TIMESTAMP}.png")
\`\`\`

### 11. 测试赊销管理
\`\`\`
wechat_click(".tab-receivable")
wechat_screenshot("${REPORT_DIR}/receivable_${TIMESTAMP}.png")
\`\`\`

### 12. 获取控制台日志
\`\`\`
wechat_console() -> ${REPORT_DIR}/console_${TIMESTAMP}.txt
\`\`\`

## 执行方式

由于 MCP 工具需要通过 Codex 的 MCP 系统调用，请在 Codex 对话框中输入：

\`\`\`
使用 wechat-devtools-mcp 进行微信小程序全自动化测试
\`\`\`

Codex 将自动执行上述所有步骤。
`;

fs.writeFileSync(path.join(REPORT_DIR, `test_plan_${TIMESTAMP}.md`), testPlan);

console.log('✅ 测试计划已创建');
console.log(`文件：${REPORT_DIR}/test_plan_${TIMESTAMP}.md`);
console.log('');
console.log('由于 wechat-devtools-mcp 需要通过 Codex 的 MCP 系统调用，');
console.log('请在 Codex 对话框中输入以下命令来执行自动化测试：');
console.log('');
console.log('  "使用 wechat-devtools-mcp 进行微信小程序全自动化测试"');
console.log('');
console.log('Codex 将自动：');
console.log('1. 打开微信开发者工具');
console.log('2. 编译项目');
console.log('3. 测试所有功能页面');
console.log('4. 每个步骤截图');
console.log('5. 获取控制台日志');
console.log('6. 生成完整测试报告');
