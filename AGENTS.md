# AGENTS.md — 乾多多小程序（fenghuai-trading）

> 生效范围：所有 AI 助手（Codex/Trae/其他）。本文件只提供【项目技术细节】；
> 全局流程规则（评审机制/交付循环/经验库/平台红线/测试方式/工程纪律）以 ~/.codex/AGENTS.md 为最高优先，冲突以全局为准。
> **规范版本**：v1.4 | **全局规则依赖版本**：v4.28 | **业务分级**：重业务（资金流+RBAC权限，2026-09-02按出错代价判据） | **更新日期**：2026-09-02

## 一句话
乾多多采购下单助手：微信小程序（4 角色 RBAC）+ 微信云开发 Serverless，覆盖 智能录入→录单→分拣→出库→赊销收款→蓝牙打印/转发销售单。MVP v1.0 为最终功能范围（无 Web 后台、无二期增强；催收/审计/趋势报表/微信支付为独立升级模块）。

## 技术栈
- 前端：微信原生小程序 + TypeScript + Vant Weapp；页面 pages/{login,index,customers,orders,new-order,order-detail,outbound,products,receivable,reports,members,profile,settings,shipping}
- 后端：微信云开发 CloudBase（env: cloud1-d6g75loi673b1e039），16 个云函数（auth/customers/orders/products/outbound/receivable/regions/report/smart/sync-data/system/users/import-data/init-db/check-customer-fields/clear-all-data），11 个数据库集合
- 打印：ESC/POS 指令 + 蓝牙 BLE（芯烨/佳博/汉印 58/80mm）
- 智能录入：腾讯云 ASR（录音文件识别）+ TokenHub NLP（OpenAI 兼容，默认 hy3）；密钥由管理员在小程序「系统设置」云端配置，未配置自动降级为纯规则引擎

## 目录结构（2026-08-19 已按全局目录纪律归位，新内容一律进规范位置）

| 位置 | 内容 |
|---|---|
| `docs/` | PRD/ERD/TDD/API/架构/用户手册等核心文档 |
| `docs/prd/` | 需求与业务数据（xlsx/源文件） |
| `docs/ui/` | 原型 HTML 与默认数据 |
| `docs/reports/` | 测试/修复/检查报告（自动化测试报告在 `tests/reports/`） |
| `docs/guide/` | 操作/部署/测试指南 |
| `~/.codex/knowledge/` + `docs/reports/项目级错误经验.md` | 错误经验（全局库 + 项目级清单） |
| `.local/` | 本地工作产物（output/screenshots/logs，不入库） |
| `deploy/scripts/` | 云函数一键部署脚本 |
| `PROJECT_STRUCTURE.md` | 保留，与 `tests/performance/` 并列维护 |
## 原型
- 原型位置：docs/ui/（乾多多采购下单助手_原型.html，唯一 UI 基准）
- 开发对齐：只对齐产品事实（字段/流程/状态/权限/文案）；演示辅助剥离（4 角色演示切换≠真实 RBAC，按登录+权限实现）——原则见全局 AGENTS.md"原型对齐原则"

## 设计token（落地全局 v4.27，重业务项目强制，2026-09-02 建立）

> 微信小程序用 rpx；原型 HTML 与页面 wxss 引用同一组值；原型对齐按 token 核对，不靠肉眼比像素。色值集中管理在 app.wxss 顶部变量，页面禁止散落硬编码。

| token | 值 | 用途 |
|---|---|---|
| 主色 primary | #07C160 | 主按钮/选中/强调（微信绿，现网实际主色；Vant Weapp 主色） |
| 主色亮 primary-bright | #45D06F | 渐变起点/悬浮态（--theme-primary-bright） |
| 主色深 primary-light | #06AD56 | 渐变终点/深绿（--theme-primary-light） |
| 成功绿 success | #16A34A | 语义色：已结清/已收/账龄绿（--theme-success，与状态红橙蓝配套） |
| 警示橙 | #FF6B35 | 待处理/风险提醒 |
| 页面底 | #F5F6F8 | 页面背景 |
| 卡片底 | #ffffff | 卡片/弹窗 |
| 字阶 | 24 / 28 / 32 / 40rpx（基线）；实测高频 22/26/30/34/36 亦在用 | 辅助/表内/正文/大数字；全 app 用 calc(Nrpx*var(--font-scale)) 体系 |
| 间距基线 | 12 / 16 / 20 / 24rpx | 组件内/组件间/区块间/页边距 |
| 圆角 | 8 / 12 / 20rpx | 标签/按钮/卡片 |

维护：改主题只改 app.wxss 变量定义处；新增色值先入本表再上代码。新原型（docs/ui/）头部必须引用本表色值。
**T66b（2026-09-02，老板授权拍板）收口**：主色以现网 #07C160 为准（不改用户可见品牌色，token 表原 #24AD52 为笔误已修正）；页面散落硬编码绿（#24AD52/#16A34A/#07C160/#06AD56/#45D06F 等 37 处）全部改 var() 引用，成功语义绿统一到 --theme-success；JS 动态色抽常量绑定 token。字阶 22/26/30 等未登记值本轮仅登记不动字号（避免全 app 视觉漂移）。

## 业务红线（改动前必查）
- 4 角色：下单员/分拣员/库管/管理员，权限矩阵 scripts/sync-perm-matrix.js（check:perms）
- 订单：新建即「待分拣」，无草稿；状态流 待分拣→已分拣→已出库→已完成
- 0 元订单不生成、不计入任何列表；已成订单中 0 件+0 包商品行不显示
- 金额守恒：应收 = 已收 + 未结清；收款两步（登记 collect：下单员/分拣员 → 确认 confirm：仅库管）
- 打印/转发模板 = 西安迈尚销售单格式，客户指定，不得擅改（无 NO.、无三方操作人追溯）

## 编码基线（三层，2026-08-19 补全，只能加严不能放宽）
- 第 1 层·通用：遵循全局 AGENTS.md【编码纪律】（任务编号/完成前自审/错误处理/安全/性能预算/兼容）
- 第 2 层·类型（微信小程序 + Serverless 后端）：
  - 云函数：一律 async/await；DB 调用有超时+统一错误返回；热路径查询必命中索引（索引名写注释）；一个云函数只做一件事；node-sdk 与 wx-server-sdk 写文档口径不得混用（见已知坑）
  - 前端：setData 控频次与体积（合并调用、大列表分页）；主包 <2MB 红线；页面按需加载；隐私接口仅授权后调用且失败降级不阻塞
  - 完整类型基线见 ~/.codex/skills/multi-agent-delivery/references/coding-baseline.md
- 第 3 层·项目特有：权限矩阵 scripts/sync-perm-matrix.js（check:perms）改动后必跑；金额/守恒红线见"业务红线"段
- 工具链门禁：npm run check:perms + test:all；CI：.github/workflows/ci.yml（lint+权限矩阵+单测）

## 子页面探测结果（2026-08-20 按全局深度探测制实测；页面结构新增后必须重探并回写本节）
- 层级锚点：主包 14 页（无分包）→ 页内 tab 切换 → 半屏弹窗/表单（无 route query 深层子页，order-detail 靠 query 参数仍属 L1）
- **L1（14 页）**：login / index / orders / new-order / order-detail / products / customers / receivable / outbound / reports / shipping / profile / members / settings（wx-pagewalk-test.js 已全覆盖）
- **L2 页内 tab（6 处，必须逐个点击遍历）**：
  - orders：time-tabs（今日/本周/全部）
  - new-order：smart-tabs（语音/文字）
  - receivable：recv-view-tabs（客户台账/未结清/已结清）
  - outbound：out-subtabs（分拣/出库）+ export-time-tabs
  - reports：report-tabs + time-tabs
  - members：权限矩阵折叠展开（perm-section 点击展开/收起）
- **L3 弹窗/表单（逐页断言可开可关、不残留）**：
  - new-order：商品选择/客户选择/智能录入等 19 处弹窗标记（商品添加、数量、备注、确认提交）
  - products：22 处（新增/编辑/删除确认）
  - customers：14 处（新增/编辑/删除确认）
  - receivable：8 处（登记收款/确认收款/折价减免弹窗）
  - order-detail：7 处（确认分拣/出库/打印/转发）
  - shipping：7 处（包裹件数编辑）
  - members：6 处（添加成员弹窗/邀请弹窗）
- 测试深度=3 层；深层无数据时 API 造一条 TEST 数据实测后清理，不以无数据跳过
- 回归脚本：L1=tests/wx-pagewalk-test.js；L2/L3=tests/wx-deepwalk-test.js（24/24 全绿，挂在 test-all.sh 第 4 步）；状态机终态守卫=tests/order-state-guard-test.js（T53，12 断言，纯 node-sdk 不占模拟器，挂第 7 步，需 QA 钩子开启）；test-all 全量共 12 步（幂等专项=第 10 步）

## 测试
- 一键全量：`npm run test:all`（scripts/test-all.sh）；单项 `npm run test:wx-e2e` 等，入口 scripts 见 package.json
- 自动化走微信开发者工具：CLI `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`；skills = wechat-devtools-automator + wechat-auto-test
- 测试数据打 TEST 前缀，测完清理；QA 模拟身份用云函数 env QA_IMPERSONATE=1
- 核心路径清单（regression.sh 必覆盖）：登录→智能录入→录单→分拣→出库→收款→蓝牙打印/转发销售单

## 部署
- 云函数一键部署：`bash deploy/scripts/auto-deploy-cloudfunctions.sh`（逐个 cli deploy）；CI：ci/upload.js（miniprogram-ci，private.key 在 ci/ 目录，勿外传）
- 云函数改动 → 先部署验证 → 确认无误再视为上线（Serverless 无服务器回滚，回滚=重新部署上一版云函数）
- 发版前：确认 cloudbaserc.json envVariables 未动；发版后冒烟：登录→录单→分拣→出库→收款

## 已知坑（项目级，开工前按关键词检索）
- @cloudbase/node-sdk 的 doc().set(x) 直接以 x 为文档内容；wx-server-sdk 用 {data: x}——两套口径混用会写出 data.data 脏结构（历史已清洗为顶层 flat）
- system 云函数 setConfig：先查后写（存在 update/不存在 add/竞争兜底 update），.set() 对已存在文档会撞 E11000
- ASR 端到端转写 >30s：callFunction 等待放宽；生产走 smart 云函数（timeout 60s）
- node-sdk 写后必须回读验证顶层 key
- 完整历史坑见：~/.codex/knowledge/errors.md（grep 项目名 fenghuai）项目级清单 docs/reports/项目级错误经验.md

## 专业角色执行细则（项目事实，v4.15 五新角色；流程条款引用全局【多角色评审机制】不复制）
- SAST：semgrep 1.174.0（已装；须在正常项目目录跑，/tmp 沙箱目录写缓存被挡）。范围 = 小程序根目录 + cloudfunctions/，排除 node_modules/；触发 = 登录/RBAC/支付/敏感数据代码变更或提审前；发现按 P0-P2 建任务卡
- MUT：stryker（@stryker-mutator/core v10 已全局装，命令 `stryker`；旧包名 stryker-js 已 404）。抽 = 金额/订单状态机/催收逻辑核心函数；触发 = 回归套件验收；存活变异体 = 弱用例 → 补断言
- INC：runbook = docs/runbook/线上事故处置runbook.md（P0-P3 分级 + 故障处置清单 + 双回滚 + QA 残留应急，2026-08-27 建成）；线上故障按册处置后走全局 INC 闭环
- APID：API 文档 = docs/api/API_接口文档.md；OpenAPI 规格 = docs/api/openapi.yaml（2026-08-27 建成，35 接口，新 action 必须同步维护）；错误码语义以文档 §1.4 为准
- DEPAUD：lockfile = 根 package-lock.json + cloudfunctions/*/package-lock.json（必入库）；audit = npm audit（根目录 + 各云函数目录）；豁免写任务卡
- 任务卡：状态字段从全局 requirement-task-template.md（待做/进行中/已做({commit})/取消(理由)）

## 文档权威顺序
PRD_产品需求文档.md > 小程序MVP落地计划与技术架构.md > TDD_技术规格书.md > ERD_数据库设计.md > API_接口文档.md（均在 docs/）
## 文档基线（九件套自查，2026-08-19 登记）
- 当前版本九件套状态：PRD✅｜开发规格✅｜业务流程✅（业务流程全景.md）｜版本路线图✅（docs/prd/版本路线图.md，T54 2026-08-30 补建）｜ERD✅｜TDD✅｜API✅｜测试用例✅｜用户手册✅（9/9 全齐）
- 缺口补文档=标准任务（走交付循环），不搭便车塞进功能提交；版本升级（vX→vY）首个任务重跑本自查
- 基线定义与最低内容要求单源见 ~/.codex/skills/multi-agent-delivery/references/project-layout.md 第 9 条（此处不复制）

## 工程纪律
- 流程类纪律（commit 时机/push/分支发版/多会话并行/凭据处理）一律以全局 ~/.codex/AGENTS.md【工程纪律】【凭据处理】为准，本文件不复制
