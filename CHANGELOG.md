# 变更日志 (Changelog)

本项目所有重要变更均记录在此文件中。

格式基于 [Conventional Changelog](https://www.conventionalcommits.org/)。

---

## [1.5] - 2026-08-23

### Changed
- 字号跟随微信系统设置：移除应用内独立字号设置（我的页字体大小入口、auth set-font-scale 死字段），全局 font-scale 由 onLaunch 按系统字号映射（70%–130% 截断），跟随微信 设置→通用→字体大小
- 原型同步删除字号调节相关 CSS/JS/入口；测试脚本断言、用户手册/测试用例/README 文案同步

### Removed
- tests/wx-fontscale-shot.js（字号专项截图脚本，入口已移除）

---

## [1.4] - 2026-08-19


### Changed
- **目录按全局目录纪律归位**：文档/→docs/、指南/→docs/guide/、报告/与 GIT/→docs/reports/、原型/→docs/ui/、需求/→docs/prd/、经验库/编程错误经验.md→docs/reports/项目级错误经验.md；根部署脚本→deploy/scripts/；output/logs/screenshots→.local/（不入库）。同步更新 README/PROJECT_STRUCTURE/AGENTS.md 路径引用，修正脚本与测试里的硬编码旧路径

### Fixed
- **qa-toggle 误删云函数 TZ 环境变量**：setRcValue 原整体替换 envVariables 会删掉 TZ=Asia/Shanghai，改为 Object.assign 合并；FNS 补齐 system/smart（均含 QA 钩子）
- **cloudbaserc.json 恢复干净生产态**：全部函数保留 TZ，10 个 QA 函数 QA_IMPERSONATE 置空
- ci/upload.js 清理失效忽略项（原型/文档/经验库/需求等），补齐 deploy/ 与 .local/
---

## [1.3] - 2026-08-17

### Added
- **定时自动确认（管理员可控）**：设置页开关 + 时间选择（默认关闭、默认 16:00）；开启后到点未确认的分拣/出库订单全部自动确认（每日一次），工作台显示定时提示并标红超时订单；关闭则不限时、不显示定时提示
- **首页右下角悬浮球**：主球「智能录入」入口（文字录入 + 语音占位），内容区右下、TabBar 上方
- 报表导出**格式选择**：Excel / CSV 双格式（默认 Excel），导出前弹窗选择

### Changed
- **销售单标题改为「{客户名}食品销售单」**：打印送货单与微信转发卡片标题随客户名动态生成（无客户名回退「丰淮商贸」）；替换原固定「西安迈尚」抬头
- TabBar 对齐实际实现：首页 / 订单 / ＋(中央新建) / 工作台 / 我的；工作台页内按角色分发（分拣/出库/赊销看板）

### Docs
- PRD/TDD 同步：定时确认由"二期"改为"已实现（管理员可控）"、销售单客户名标题、TabBar 口径、导出双格式、首页悬浮球
- 根目录散落报告/指南归拢至 `报告/`、`指南/`、`GIT/`；`output/`、`logs/` 加入 .gitignore

---

## [1.2] - 2026-08-17

### Added
- 全部导出（报表/客户汇总/收款台账/出库库单/送货单）支持**自定义时间区间**（起止日期，picker 选择），与今日/本周/本月并存
- 云函数 `orders` create/update 新增**物品行双重校验**：有效商品为空或物品金额合计 ≤0 时拦截不生成（防 `totalAmount>0` 但物品金额为 0 的脏数据）

### Changed
- **0 值统一不显示**：数量 0 的件/包不体现（1件0包 只显示 1件及其价格）；金额/单价 0 不显示；物流大/中/小件 0 不显示
- 导出 Excel/CSV 中 0 值单元格**留空**（`exportOutbound`、`exportLedger`、`exportDailySummary` 件数列用 `pkgShow` 0→空）
- 订单列表/详情页商品行：0件0包 过滤、金额 0 不显示金额
- 订单列表商品明细改用 `qtyText`（件+包合并、0不显示）
- 全量文档同步（PRD §4.3A.3、TDD §6.1A、CHANGELOG、原型 reports/outbound 页）

### Fixed
- `exportOutbound` 物流中件=0 显示 `0` 的问题（改 0 留空）
- 报表 custom 区间测试断言错误（改用客户视图对比）
- 清理 `cloudfunctions/orders/miniprogram_npm` 冗余依赖（4.8MB）

### Docs
- 0 值逻辑口径写入 PRD/TDD；导出时间区间写入相关文档

---

## [1.1] - 2026-08-10

### Added
- 新增智能录入功能（文字/语音快速下单）
- 新增商品别名表 `product_aliases` 和客户别名表 `customer_aliases`
- 新增 `smart` 云函数（智能匹配 + 语音转文字）
- 新增 `smart.match` 和 `smart.transcribe` 两个 API 接口
- 新增开发规范说明书、测试用例文档
- 新增 CHANGELOG.md 变更日志

### Changed
- MVP 功能从 12 项扩展为 13 项
- 工期从 30 人天调整为 33 人天
- 云函数从 8 个扩展为 9 个
- 数据库集合从 7 个扩展为 8 个
- API 接口从 25 个扩展为 27 个
- 全量文档按原型同步更新，统一数据口径

### Removed
- 移除演示版（build_demo.py）相关引用
- 删除根目录重复的原型文件

---

## [1.0] - 2026-08-05

### Added
- MVP 定稿：12 项功能范围确认
- 完成全套文档体系（PRD/TDD/ERD/API/用户手册/部署运维/产品评估/业务流程/工期评估）
- 完成手机端交互原型（唯一原型，localStorage 本地数据）
- 4 角色权限矩阵（下单员/分拣员/库管/管理员）
- 订单状态机：待分拣→已分拣→已出库→已完成
- 收款状态机：unpaid→pending→paid（两步分离）
- 销售单打印模板（西安迈尚版）
- 全局字号缩放（适老化）
- 0 元订单拦截
- 商品/客户管理全角色 CRUD
- 赊销收款管理（登记→确认两步）
- 转发客户微信
- 报表统计（商品汇总/客户汇总/收款台账）
- 分拣出库工作台
- 导出中心（Excel/CSV）

### Changed
- 取消订单级「收款方式」选择，所有订单默认未付款
- 分拣驳回/暂存配货/物流件型弹窗移入二期规划
- 导出中心标注为 MVP 不含（独立升级模块）

### Removed
- 取消 Web 后台方案（方案B），统一为全员小程序
- 取消审计日志、价格变更日志（独立升级模块）

---

## [0.9] - 2026-08-04

### Added
- 项目初始化
- 需求调研与整理
- 技术方案选型（微信云开发 + 蓝牙打印）
- 初版原型设计

### Changed
- 从方案B（极简版）调整为方案A（全员小程序）
- 数据库从关系型调整为 MongoDB（云开发数据库）

---

## 版本说明

| 符号 | 含义 |
|------|------|
| [1.1] | 次版本号，新增完整模块 |
| [1.0] | 主版本号，MVP 定稿 |
| [0.9] | 预发布版本 |

### 变更类型

| 类型 | 含义 |
|------|------|
| Added | 新增功能 |
| Changed | 功能变更 |
| Fixed | 问题修复 |
| Removed | 移除功能 |
| Deprecated | 即将废弃 |
