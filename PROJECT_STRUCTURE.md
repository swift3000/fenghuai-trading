# 项目结构说明

## 📁 目录结构

```
fenghuai-trading/
├── 📱 核心代码
│   ├── app.js              # 小程序入口
│   ├── app.json            # 全局配置
│   ├── app.wxss            # 全局样式
│   ├── pages/              # 所有页面
│   ├── components/         # 自定义组件
│   ├── utils/              # 工具函数
│   ├── constants/          # 常量配置
│   └── cloudfunctions/     # 云函数
│
├── 📄 docs/                # 全部文档（全局目录纪律，2026-08-19 归位）
│   ├── *.md                # 正式设计/产品/部署文档（PRD/TDD/ERD/API/用户手册等）
│   ├── ui/                 # 交互原型（唯一原型 HTML + 种子数据快照）
│   ├── guide/              # 操作与测试指南
│   ├── reports/            # 测试/修复/验证报告 + 任务卡 + 项目级错误经验
│   └── prd/                # 需求原始资料（xlsx/docx，不入库）
│
├── 🧪 测试
│   ├── tests/              # 测试用例
│   ├── scripts/            # 自动化脚本
│   └── .local/             # 测试输出/截图/日志（不入库）
│
├── 🔧 工具
│   ├── scripts/            # 自动化脚本
│   │   ├── full-automation-test.sh
│   │   ├── wechat_devtools_automator.sh
│   │   └── ...
│   └── loop_project/       # Loop 项目配置
│
├── 📚 资源
│   └── assets/             # 静态资源
│
└── 🔐 deploy/scripts/      # 部署脚本（auto-deploy-cloudfunctions.sh 等）
```

## 📂 主要目录说明

### 核心代码
- **pages/** - 16 个业务页面
  - index (首页)
  - login (登录)
  - orders (订单列表)
  - new-order (新建订单)
  - order-detail (订单详情)
  - products (商品管理)
  - customers (客户管理)
  - receivable (赊销管理)
  - outbound (分拣出库)
  - reports (报表统计)
  - members (成员管理)
  - profile (我的)
  - settings (设置)
  - shipping (配送)

- **cloudfunctions/** - 14 个云函数
  - auth (认证)
  - orders (订单)
  - products (商品)
  - customers (客户)
  - receivable (赊销)
  - report (报表)
  - outbound (出库)
  - users (用户)
  - system (系统)
  - regions (区域)
  - smart (智能录入)
  - 等...

### 测试相关
- **logs/** - 所有测试日志文件
- **screenshots/** - 测试截图
- **output/** - 最新自动化测试输出
- **scripts/** - 自动化测试脚本

### 文档相关
- **docs/** - 全部项目文档（设计/产品/部署）
- **docs/ui/** - 原型设计图
- **docs/guide/** - 操作与测试指南
- **docs/reports/** - 测试/修复/验证报告

## 🚀 快速开始

### 1. 开发环境
```bash
# 安装依赖
npm install

# 打开微信开发者工具
open -a wechatwebdevtools
```

### 2. 上传云函数
```bash
# 在微信开发者工具中：
# 右键 cloudfunctions -> 上传并部署：云端安装依赖
```

### 3. 运行自动化测试
```bash
# 完整测试
bash scripts/full-automation-test.sh

# 单个页面测试
/Users/god/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh \
  shot --project . --route pages/index/index
```

## 📊 当前状态

- ✅ 自动化测试工具已配置
- ✅ 测试脚本已就绪
- ⚠️ 云函数需要上传到微信云端
- ⚠️ 部分页面功能需要修复

## 📝 最近测试报告

查看最新测试报告：
- [自动化测试报告 -20260814.md](./docs/reports/自动化测试报告_2026-08-11.md)
- [修复报告](./docs/reports/修复报告.md)
- [云函数部署指南](./docs/guide/云函数部署指南.md)

---

**最后更新**: 2026-08-14
