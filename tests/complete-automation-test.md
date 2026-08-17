# 全自动化测试执行计划

## 测试目标
1. 打开微信开发者工具
2. 编译小程序项目
3. 测试所有功能页面
4. 每个步骤截图
5. 对比原型，检查 UI 和功能
6. 生成完整测试报告

## 测试步骤

### 1. 环境准备
- [x] 项目路径：`/Users/god/Desktop/项目/github/fenghuai-trading`
- [x] 微信开发者工具已安装
- [x] wechat-devtools-mcp 已配置

### 2. 测试流程

#### 2.1 登录测试
1. 打开微信开发者工具
2. 打开项目
3. 编译项目
4. 截图登录页面
5. 点击微信一键登录
6. 截图首页

#### 2.2 新建订单测试
1. 点击新建订单按钮
2. 选择客户（点击客户选择器，选择第一个客户）
3. 添加商品（点击添加商品，选择第一个商品）
4. 输入数量
5. 提交订单
6. 截图订单详情

#### 2.3 订单列表测试
1. 点击底部导航 - 订单
2. 截图订单列表
3. 点击第一个订单
4. 截图订单详情

#### 2.4 商品管理测试
1. 点击商品管理
2. 截图商品列表
3. 点击添加商品
4. 截图添加商品表单
5. 测试分类筛选
6. 测试排序功能
7. 测试导出功能

#### 2.5 客户管理测试
1. 点击客户管理
2. 截图客户列表
3. 搜索客户
4. 截图搜索结果

#### 2.6 赊销管理测试
1. 点击底部导航 - 赊销
2. 截图赊销页面
3. 点击收款确认
4. 截图收款确认弹窗
5. 点击导出
6. 截图导出选项

#### 2.7 分拣出库测试
1. 点击底部导航 - 分拣出库
2. 截图分拣页面

#### 2.8 我的页面测试
1. 点击底部导航 - 我的
2. 截图我的页面
3. 点击成员管理
4. 截图成员管理页面

### 3. 控制台日志
- 获取所有页面的控制台日志
- 检查是否有错误
- 保存日志文件

### 4. 生成报告
- 对比原型和实际实现
- 记录问题和修复建议
- 生成完整测试报告

## 预期输出

### 截图文件
- `tests/reports/login_*.png`
- `tests/reports/home_*.png`
- `tests/reports/new_order_*.png`
- `tests/reports/order_detail_*.png`
- `tests/reports/orders_*.png`
- `tests/reports/products_*.png`
- `tests/reports/customers_*.png`
- `tests/reports/receivable_*.png`
- `tests/reports/outbound_*.png`
- `tests/reports/profile_*.png`
- `tests/reports/members_*.png`

### 日志文件
- `tests/reports/console_log_*.txt`

### 测试报告
- `tests/reports/test_report_*.md`

## 执行方式

使用 Computer Use 技能执行自动化测试：
1. 打开微信开发者工具
2. 导航到各个页面
3. 点击按钮和输入框
4. 截图保存
5. 检查控制台日志

或者使用 wechat-devtools-mcp 的 MCP 工具：
- `wechat_ide_status()` - 检查环境
- `wechat_open()` - 打开项目
- `wechat_compile()` - 编译
- `wechat_screenshot()` - 截图
- `wechat_console()` - 获取日志
- `wechat_click()` - 点击元素
- `wechat_scroll()` - 滚动页面

## 完成标准
- [x] 所有页面测试完成
- [x] 所有截图已保存
- [x] 控制台日志已检查
- [x] 测试报告已生成
- [x] 问题已记录
