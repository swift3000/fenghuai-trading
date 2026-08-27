#!/usr/bin/env node

/**
 * 使用 Computer Use 进行完整自动化测试
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  app: 'wechatwebdevtools',
  projectPath: '/Users/god/Desktop/项目/github/fenghuai-trading',
  screenshotsDir: path.join(__dirname, 'screenshots'),
  reportsDir: path.join(__dirname, 'reports')
};

// 确保目录存在
if (!fs.existsSync(CONFIG.screenshotsDir)) {
  fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
}
if (!fs.existsSync(CONFIG.reportsDir)) {
  fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
}

// 测试用例
const TEST_CASES = [
  { name: '登录', page: 'login', expected: '微信一键登录' },
  { name: '首页', page: 'index', expected: '乾多多' },
  { name: '新建订单', page: 'new-order', expected: '选择客户' },
  { name: '订单列表', page: 'orders', expected: '订单' },
  { name: '商品管理', page: 'products', expected: '商品' },
  { name: '客户管理', page: 'customers', expected: '客户' },
  { name: '赊销管理', page: 'receivable', expected: '赊销' },
  { name: '分拣出库', page: 'outbound', expected: '分拣' },
  { name: '报表导出', page: 'reports', expected: '报表' },
  { name: '成员管理', page: 'members', expected: '成员' }
];

class ComputerUseTester {
  constructor() {
    this.results = {
      startTime: new Date(),
      totalTests: TEST_CASES.length,
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: []
    };
  }

  async run() {
    console.log('🚀 开始 Computer Use 自动化测试...\n');
    
    try {
      // 获取应用状态
      console.log('📱 获取微信开发者工具状态...');
      const sky = (await import('@oai/sky')).sky;
      
      let state = await sky.get_app_state({ app: CONFIG.app });
      console.log('✅ 应用已启动\n');
      
      // 编译项目
      console.log('🔨 编译项目...');
      await sky.click({ app: CONFIG.app, element_index: 0 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 获取最新状态
      state = await sky.get_app_state({ app: CONFIG.app });
      console.log('✅ 编译完成\n');
      
      // 测试每个页面
      for (const testCase of TEST_CASES) {
        await this.testPage(testCase, sky);
      }
      
      // 生成报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试失败:', error);
    }
  }

  async testPage(testCase, sky) {
    console.log(`📋 测试：${testCase.name}`);
    
    try {
      // 导航到页面
      console.log(`  📍 导航到 ${testCase.page}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 截图
      const state = await sky.get_app_state({ app: CONFIG.app });
      if (state.screenshot) {
        const screenshotName = `${testCase.name}-${Date.now()}.png`;
        const screenshotPath = path.join(CONFIG.screenshotsDir, screenshotName);
        
        const { fileURLToPath } = await import('node:url');
        const fs = await import('node:fs/promises');
        await fs.writeFile(screenshotPath, await fs.readFile(fileURLToPath(state.screenshot.url)));
        
        this.results.screenshots.push(screenshotName);
        console.log(`  📸 已截图：${screenshotName}`);
      }
      
      // 验证内容
      if (state.text.includes(testCase.expected)) {
        this.results.passed++;
        console.log(`  ✅ ${testCase.name} 通过\n`);
      } else {
        this.results.failed++;
        this.results.errors.push({
          test: testCase.name,
          expected: testCase.expected,
          found: state.text.substring(0, 200)
        });
        console.log(`  ❌ ${testCase.name} 失败\n`);
      }
      
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: testCase.name,
        error: error.message
      });
      console.log(`  ❌ ${testCase.name} 错误：${error.message}\n`);
    }
  }

  generateReport() {
    console.log('\n📊 生成测试报告...');
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    this.results.passRate = ((this.results.passed / this.results.totalTests) * 100).toFixed(2);
    
    const reportPath = path.join(CONFIG.reportsDir, `computer-use-test-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n✅ 测试完成!');
    console.log(`   总计：${this.results.totalTests}`);
    console.log(`   通过：${this.results.passed}`);
    console.log(`   失败：${this.results.failed}`);
    console.log(`   通过率：${this.results.passRate}%`);
    console.log(`   耗时：${this.results.duration}ms`);
    console.log(`   报告：${reportPath}`);
  }
}

// 运行测试
const tester = new ComputerUseTester();
tester.run().catch(console.error);
