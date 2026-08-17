// 微信开发者工具自动化测试脚本
const fs = require('fs');
const path = require('path');

// 初始化 sky
globalThis.sky = (await import("@oai/sky")).sky;

const CONFIG = {
  app: 'wechatwebdevtools',
  projectPath: '/Users/god/Desktop/项目/github/fenghuai-trading',
  screenshotsDir: path.join(__dirname, 'screenshots'),
  reportsDir: path.join(__dirname, 'reports')
};

// 测试用例
const TEST_CASES = [
  { name: '登录', page: 'login', actions: ['click_login_button'], expected: '首页' },
  { name: '新建订单', page: 'new-order', actions: ['select_customer', 'add_product', 'submit_order'], expected: '订单创建成功' },
  { name: '订单列表', page: 'orders', actions: ['view_orders', 'click_order_detail'], expected: '订单详情' },
  { name: '商品管理', page: 'products', actions: ['view_products', 'search_product'], expected: '商品列表' },
  { name: '客户管理', page: 'customers', actions: ['view_customers', 'search_customer'], expected: '客户列表' },
  { name: '赊销管理', page: 'receivable', actions: ['view_receivables', 'confirm_payment'], expected: '收款确认' },
  { name: '分拣出库', page: 'outbound', actions: ['view_outbound_orders', 'confirm_outbound'], expected: '出库成功' },
  { name: '报表导出', page: 'reports', actions: ['view_reports', 'export_data'], expected: '导出成功' },
  { name: '成员管理', page: 'members', actions: ['view_members', 'invite_member'], expected: '邀请成功' }
];

class WechatAutoTest {
  constructor() {
    this.results = {
      startTime: new Date(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: []
    };
  }

  async run() {
    console.log('🚀 开始微信开发者工具自动化测试...');
    
    try {
      // 1. 获取应用状态
      console.log('📱 获取微信开发者工具状态...');
      let state = await sky.get_app_state({ app: CONFIG.app });
      console.log('应用已启动');
      
      // 2. 编译项目
      console.log('🔨 编译项目...');
      await this.compileProject();
      
      // 3. 执行测试用例
      for (const testCase of TEST_CASES) {
        await this.runTestCase(testCase);
      }
      
      // 4. 生成报告
      await this.generateReport();
      
    } catch (error) {
      console.error('测试失败:', error);
    }
  }

  async compileProject() {
    // 点击编译按钮
    await sky.click({ app: CONFIG.app, element_index: 0 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 检查编译状态
    const state = await sky.get_app_state({ app: CONFIG.app });
    console.log('编译状态:', state.text.substring(0, 200));
  }

  async runTestCase(testCase) {
    console.log(`\n📋 测试：${testCase.name}`);
    this.results.totalTests++;
    
    try {
      // 导航到页面
      await this.navigateToPage(testCase.page);
      
      // 执行动作
      for (const action of testCase.actions) {
        await this.executeAction(action);
      }
      
      // 截图
      const screenshot = await this.takeScreenshot(testCase.name);
      
      // 验证结果
      const passed = await this.verifyResult(testCase.expected);
      
      if (passed) {
        this.results.passed++;
        console.log(`  ✅ ${testCase.name} 通过`);
      } else {
        this.results.failed++;
        this.results.errors.push({
          test: testCase.name,
          error: '结果验证失败',
          screenshot: screenshot
        });
        console.log(`  ❌ ${testCase.name} 失败`);
      }
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: testCase.name,
        error: error.message
      });
      console.log(`  ❌ ${testCase.name} 错误：${error.message}`);
    }
  }

  async navigateToPage(page) {
    console.log(`  📍 导航到：${page}`);
    // 点击底部导航栏
    await sky.click({ app: CONFIG.app, element_index: 0 });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async executeAction(action) {
    console.log(`  ⚡ 执行：${action}`);
    // 根据动作类型执行不同的操作
    await sky.click({ app: CONFIG.app, element_index: 0 });
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  async takeScreenshot(testName) {
    const filename = `${testName}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);
    
    console.log(`  📸 截图：${filename}`);
    const state = await sky.get_app_state({ app: CONFIG.app });
    
    if (state.screenshot) {
      const fs = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      await fs.writeFile(filepath, await fs.readFile(fileURLToPath(state.screenshot.url)));
      return filename;
    }
  }

  async verifyResult(expected) {
    console.log(`  🔍 验证：${expected}`);
    const state = await sky.get_app_state({ app: CONFIG.app });
    return state.text.includes(expected);
  }

  async generateReport() {
    console.log('\n📊 生成测试报告...');
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    this.results.passRate = ((this.results.passed / this.results.totalTests) * 100).toFixed(2);
    
    const reportPath = path.join(CONFIG.reportsDir, `auto-test-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n✅ 测试完成!');
    console.log(`   总计：${this.results.totalTests}`);
    console.log(`   通过：${this.results.passed}`);
    console.log(`   失败：${this.results.failed}`);
    console.log(`   通过率：${this.results.passRate}%`);
    console.log(`   耗时：${this.results.duration}ms`);
  }
}

// 运行测试
const test = new WechatAutoTest();
test.run().catch(console.error);
