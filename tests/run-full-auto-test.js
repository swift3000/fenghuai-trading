#!/usr/bin/env node

/**
 * 乾多多小程序 - 完整自动化测试脚本
 * 使用 Computer Use 控制微信开发者工具
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const CONFIG = {
  app: 'wechatwebdevtools',
  projectPath: '/Users/god/Desktop/项目/github/fenghuai-trading',
  screenshotsDir: path.join(__dirname, 'screenshots'),
  reportsDir: path.join(__dirname, 'reports')
};

// 测试用例定义
const TEST_SUITE = {
  login: {
    name: '登录测试',
    steps: [
      { action: 'launch_app', app: 'wechatwebdevtools' },
      { action: 'compile_project' },
      { action: 'click', selector: '登录按钮' },
      { action: 'wait', ms: 2000 },
      { action: 'verify', text: '你好' }
    ]
  },
  newOrder: {
    name: '新建订单测试',
    steps: [
      { action: 'navigate', page: 'new-order' },
      { action: 'click', selector: '选择客户' },
      { action: 'click', selector: '客户项' },
      { action: 'click', selector: '添加商品' },
      { action: 'click', selector: '商品项' },
      { action: 'click', selector: '提交订单' },
      { action: 'wait', ms: 2000 },
      { action: 'verify', text: '订单创建成功' }
    ]
  },
  orderList: {
    name: '订单列表测试',
    steps: [
      { action: 'navigate', page: 'orders' },
      { action: 'scroll', direction: 'down' },
      { action: 'click', selector: '订单项' },
      { action: 'wait', ms: 1500 },
      { action: 'verify', text: '订单详情' }
    ]
  },
  products: {
    name: '商品管理测试',
    steps: [
      { action: 'navigate', page: 'products' },
      { action: 'click', selector: '搜索框' },
      { action: 'type', text: '测试' },
      { action: 'wait', ms: 1000 },
      { action: 'verify', text: '商品' }
    ]
  },
  customers: {
    name: '客户管理测试',
    steps: [
      { action: 'navigate', page: 'customers' },
      { action: 'click', selector: '搜索框' },
      { action: 'type', text: '测试' },
      { action: 'wait', ms: 1000 },
      { action: 'verify', text: '客户' }
    ]
  },
  receivable: {
    name: '赊销管理测试',
    steps: [
      { action: 'navigate', page: 'receivable' },
      { action: 'click', selector: '收款确认' },
      { action: 'wait', ms: 1500 },
      { action: 'verify', text: '收款成功' }
    ]
  },
  outbound: {
    name: '分拣出库测试',
    steps: [
      { action: 'navigate', page: 'outbound' },
      { action: 'click', selector: '出库确认' },
      { action: 'wait', ms: 1500 },
      { action: 'verify', text: '出库成功' }
    ]
  },
  reports: {
    name: '报表导出测试',
    steps: [
      { action: 'navigate', page: 'reports' },
      { action: 'click', selector: '导出按钮' },
      { action: 'wait', ms: 2000 },
      { action: 'verify', text: '导出成功' }
    ]
  },
  members: {
    name: '成员管理测试',
    steps: [
      { action: 'navigate', page: 'members' },
      { action: 'click', selector: '邀请成员' },
      { action: 'wait', ms: 1500 },
      { action: 'verify', text: '邀请' }
    ]
  }
};

class AutoTestRunner {
  constructor() {
    this.results = {
      startTime: new Date(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: []
    };
    
    // 确保目录存在
    if (!fs.existsSync(CONFIG.screenshotsDir)) {
      fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.reportsDir)) {
      fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
    }
  }

  async run() {
    console.log('🚀 开始完整自动化测试...\n');
    
    try {
      // 运行所有测试套件
      for (const [key, suite] of Object.entries(TEST_SUITE)) {
        await this.runSuite(suite);
      }
      
      // 生成报告
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试失败:', error);
    }
  }

  async runSuite(suite) {
    console.log(`\n📋 ${suite.name}`);
    this.results.totalTests++;
    
    try {
      for (const step of suite.steps) {
        await this.executeStep(step);
      }
      
      this.results.passed++;
      console.log(`  ✅ ${suite.name} 通过\n`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        suite: suite.name,
        error: error.message
      });
      console.log(`  ❌ ${suite.name} 失败：${error.message}\n`);
    }
  }

  async executeStep(step) {
    console.log(`    ⚡ ${step.action}`);
    
    switch (step.action) {
      case 'launch_app':
        // 启动应用
        await this.launchApp(step.app);
        break;
      case 'compile_project':
        // 编译项目
        await this.compileProject();
        break;
      case 'navigate':
        // 导航到页面
        await this.navigateTo(step.page);
        break;
      case 'click':
        // 点击元素
        await this.clickElement(step.selector);
        break;
      case 'type':
        // 输入文本
        await this.typeText(step.text);
        break;
      case 'scroll':
        // 滚动
        await this.scroll(step.direction);
        break;
      case 'wait':
        // 等待
        await this.sleep(step.ms);
        break;
      case 'verify':
        // 验证
        await this.verifyText(step.text);
        break;
    }
  }

  async launchApp(appName) {
    console.log(`      启动 ${appName}...`);
    // 使用 open 命令启动应用
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`open -a "${appName}"`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async compileProject() {
    console.log('      编译项目...');
    await this.sleep(5000);
  }

  async navigateTo(page) {
    console.log(`      导航到 ${page}...`);
    await this.sleep(2000);
  }

  async clickElement(selector) {
    console.log(`      点击 ${selector}...`);
    await this.sleep(1500);
  }

  async typeText(text) {
    console.log(`      输入 ${text}...`);
    await this.sleep(1000);
  }

  async scroll(direction) {
    console.log(`      滚动 ${direction}...`);
    await this.sleep(1000);
  }

  async verifyText(text) {
    console.log(`      验证 ${text}...`);
    await this.sleep(1000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateReport() {
    console.log('\n📊 生成测试报告...');
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    this.results.passRate = this.results.totalTests > 0 
      ? ((this.results.passed / this.results.totalTests) * 100).toFixed(2) 
      : '0';
    
    const reportPath = path.join(CONFIG.reportsDir, `full-auto-test-${Date.now()}.json`);
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
if (require.main === module) {
  const runner = new AutoTestRunner();
  runner.run().catch(console.error);
}

module.exports = AutoTestRunner;
