// Computer Use 自动化测试脚本
// 使用 @oai/sky 控制微信开发者工具

const { computerUse } = require('@oai/sky');

async function runFullAutomationTest() {
  console.log('==========================================');
  console.log('  微信小程序全自动化测试（Computer Use）');
  console.log('==========================================');
  
  const REPORT_DIR = '/Users/god/Desktop/项目/github/fenghuai-trading/tests/reports';
  const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  try {
    // 1. 打开微信开发者工具
    console.log('\n📱 步骤 1: 打开微信开发者工具');
    await computerUse.openApp('微信开发者工具');
    await computerUse.wait(3000);
    
    // 2. 截图初始状态
    console.log('📸 步骤 2: 截图初始状态');
    await computerUse.screenshot(`${REPORT_DIR}/initial_${TIMESTAMP}.png`);
    
    // 3. 编译项目
    console.log('🔨 步骤 3: 编译项目');
    await computerUse.click({ selector: '文本：编译' });
    await computerUse.wait(5000);
    
    // 4. 截图编译后状态
    console.log('📸 步骤 4: 截图编译后');
    await computerUse.screenshot(`${REPORT_DIR}/compiled_${TIMESTAMP}.png`);
    
    // 5. 获取控制台日志
    console.log('📋 步骤 5: 获取控制台日志');
    await computerUse.click({ selector: '标签：调试器' });
    await computerUse.click({ selector: '标签：Console' });
    await computerUse.wait(1000);
    const consoleText = await computerUse.getText({ selector: '.console-output' });
    await computerUse.writeFile(`${REPORT_DIR}/console_${TIMESTAMP}.txt`, consoleText);
    
    // 6. 测试登录
    console.log('🔐 步骤 6: 测试登录');
    await computerUse.screenshot(`${REPORT_DIR}/login_${TIMESTAMP}.png`);
    await computerUse.click({ selector: '按钮：微信一键登录' });
    await computerUse.wait(3000);
    
    // 7. 截图首页
    console.log('📸 步骤 7: 截图首页');
    await computerUse.screenshot(`${REPORT_DIR}/home_${TIMESTAMP}.png`);
    
    // 8. 测试新建订单
    console.log('📝 步骤 8: 测试新建订单');
    await computerUse.click({ selector: '按钮：新建订单' });
    await computerUse.wait(2000);
    await computerUse.screenshot(`${REPORT_DIR}/new_order_${TIMESTAMP}.png`);
    
    // 9. 选择客户
    console.log('👤 步骤 9: 选择客户');
    await computerUse.click({ selector: '客户选择器' });
    await computerUse.wait(1000);
    await computerUse.click({ selector: '客户列表项:first-child' });
    await computerUse.wait(1000);
    
    // 10. 添加商品
    console.log('📦 步骤 10: 添加商品');
    await computerUse.click({ selector: '按钮：添加商品' });
    await computerUse.wait(1000);
    await computerUse.click({ selector: '商品列表项:first-child' });
    await computerUse.wait(1000);
    await computerUse.type({ text: '1' }); // 输入数量
    await computerUse.wait(1000);
    
    // 11. 提交订单
    console.log('✅ 步骤 11: 提交订单');
    await computerUse.click({ selector: '按钮：提交订单' });
    await computerUse.wait(2000);
    await computerUse.screenshot(`${REPORT_DIR}/order_submitted_${TIMESTAMP}.png`);
    
    // 12. 测试订单列表
    console.log('📋 步骤 12: 测试订单列表');
    await computerUse.click({ selector: '底部导航：订单' });
    await computerUse.wait(1000);
    await computerUse.screenshot(`${REPORT_DIR}/orders_${TIMESTAMP}.png`);
    
    // 13. 测试商品管理
    console.log('🏷️  步骤 13: 测试商品管理');
    await computerUse.click({ selector: '底部导航：首页' });
    await computerUse.wait(500);
    await computerUse.click({ selector: '按钮：商品管理' });
    await computerUse.wait(2000);
    await computerUse.screenshot(`${REPORT_DIR}/products_${TIMESTAMP}.png`);
    
    // 14. 测试客户管理
    console.log('👥 步骤 14: 测试客户管理');
    await computerUse.click({ selector: '按钮：客户管理' });
    await computerUse.wait(2000);
    await computerUse.screenshot(`${REPORT_DIR}/customers_${TIMESTAMP}.png`);
    
    // 15. 测试赊销管理
    console.log('💰 步骤 15: 测试赊销管理');
    await computerUse.click({ selector: '底部导航：赊销' });
    await computerUse.wait(1000);
    await computerUse.screenshot(`${REPORT_DIR}/receivable_${TIMESTAMP}.png`);
    
    // 16. 测试分拣出库
    console.log('🚚 步骤 16: 测试分拣出库');
    await computerUse.click({ selector: '底部导航：分拣出库' });
    await computerUse.wait(1000);
    await computerUse.screenshot(`${REPORT_DIR}/outbound_${TIMESTAMP}.png`);
    
    // 17. 测试我的页面
    console.log('👤 步骤 17: 测试我的页面');
    await computerUse.click({ selector: '底部导航：我的' });
    await computerUse.wait(1000);
    await computerUse.screenshot(`${REPORT_DIR}/profile_${TIMESTAMP}.png`);
    
    // 18. 测试成员管理
    console.log('👥 步骤 18: 测试成员管理');
    await computerUse.click({ selector: '按钮：成员管理' });
    await computerUse.wait(2000);
    await computerUse.screenshot(`${REPORT_DIR}/members_${TIMESTAMP}.png`);
    
    // 19. 最终控制台日志
    console.log('📋 步骤 19: 获取最终控制台日志');
    await computerUse.click({ selector: '标签：调试器' });
    await computerUse.click({ selector: '标签：Console' });
    await computerUse.wait(1000);
    const finalConsoleText = await computerUse.getText({ selector: '.console-output' });
    await computerUse.writeFile(`${REPORT_DIR}/console_final_${TIMESTAMP}.txt`, finalConsoleText);
    
    // 20. 生成测试报告
    console.log('📊 步骤 20: 生成测试报告');
    const report = `# 全自动化测试报告

**生成时间**: ${new Date().toISOString()}
**项目**: fenghuai-trading
**测试工具**: Computer Use

## 测试截图

| 页面 | 截图文件 |
|------|---------|
| 初始状态 | [查看](./initial_${TIMESTAMP}.png) |
| 编译后 | [查看](./compiled_${TIMESTAMP}.png) |
| 登录页 | [查看](./login_${TIMESTAMP}.png) |
| 首页 | [查看](./home_${TIMESTAMP}.png) |
| 新建订单 | [查看](./new_order_${TIMESTAMP}.png) |
| 订单列表 | [查看](./orders_${TIMESTAMP}.png) |
| 商品管理 | [查看](./products_${TIMESTAMP}.png) |
| 客户管理 | [查看](./customers_${TIMESTAMP}.png) |
| 赊销管理 | [查看](./receivable_${TIMESTAMP}.png) |
| 分拣出库 | [查看](./outbound_${TIMESTAMP}.png) |
| 我的页面 | [查看](./profile_${TIMESTAMP}.png) |
| 成员管理 | [查看](./members_${TIMESTAMP}.png) |

## 控制台日志

- [初始日志](./console_${TIMESTAMP}.txt)
- [最终日志](./console_final_${TIMESTAMP}.txt)

## 测试状态

✅ 全自动化测试完成
`;
    await computerUse.writeFile(`${REPORT_DIR}/full_automation_report_${TIMESTAMP}.md`, report);
    
    console.log('\n==========================================');
    console.log('  ✅ 全自动化测试完成！');
    console.log('==========================================');
    console.log(`生成的文件保存在：${REPORT_DIR}`);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

runFullAutomationTest();
