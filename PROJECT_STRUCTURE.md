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
├── 📄 文档
│   ├── README.md           # 项目说明
│   ├── CHANGELOG.md        # 更新日志
│   ├── 文档/               # 正式设计/产品/部署文档
│   ├── 报告/               # 测试/修复/验证报告
│   ├── 指南/               # 操作与测试指南
│   ├── GIT/                # git 提交备忘
│   └── 原型/               # 原型设计（含新版原型）
│
├── 🧪 测试
│   ├── tests/              # 测试用例
│   ├── scripts/            # 自动化脚本
│   ├── output/             # 测试输出/截图（不上传）
│   └── logs/               # 测试日志（不上传）
│
├── 🔧 工具
│   ├── scripts/            # 自动化脚本
│   │   ├── full-automation-test.sh
│   │   ├── wechat_devtools_automator.sh
│   │   └── ...
│   └── loop_project/       # Loop 项目配置
│
└── 📚 资源
    ├── assets/             # 静态资源
    └── 文档/               # 项目文档
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
- **docs/** - 测试报告和文档
- **原型/** - 原型设计图
- **文档/** - 项目详细文档

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
- [自动化测试报告 -20260814.md](./docs/自动化测试报告 -20260814.md)
- [修复报告](./docs/修复报告.md)
- [云函数部署指南](./docs/云函数部署指南.md)

---

**最后更新**: 2026-08-14
