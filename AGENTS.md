# AGENTS.md — 丰淮商贸小程序（fenghuai-trading）

> 生效范围：所有 AI 助手（Codex/Trae/其他）。本文件只提供【项目技术细节】；
> 全局流程规则（评审机制/交付循环/经验库/平台红线/测试方式/工程纪律）以 ~/.codex/AGENTS.md 为最高优先，冲突以全局为准。
> **规范版本**：v1.2 | **全局规则依赖版本**：v4.4 | **更新日期**：2026-08-19

## 一句话
丰淮商贸采购下单助手：微信小程序（4 角色 RBAC）+ 微信云开发 Serverless，覆盖 智能录入→录单→分拣→出库→赊销收款→蓝牙打印/转发销售单。MVP v1.0 为最终功能范围（无 Web 后台、无二期增强；催收/审计/趋势报表/微信支付为独立升级模块）。

## 技术栈
- 前端：微信原生小程序 + TypeScript + Vant Weapp；页面 pages/{login,index,customers,orders,new-order,order-detail,outbound,products,receivable,reports,members,profile,settings,shipping}
- 后端：微信云开发 CloudBase（env: cloud1-d6g75loi673b1e039），15 个云函数（auth/customers/orders/products/outbound/receivable/regions/report/smart/system/users/import-data/init-db/check-customer-fields/clear-all-data），11 个数据库集合
- 打印：ESC/POS 指令 + 蓝牙 BLE（芯烨/佳博/汉印 58/80mm）
- 智能录入：腾讯云 ASR（录音文件识别）+ TokenHub NLP（OpenAI 兼容，默认 hy3）；密钥由管理员在小程序「系统设置」云端配置，未配置自动降级为纯规则引擎

## 目录映射（存量项目，新内容一律进规范位置，搬迁留到大改版）

| 现状 | 规范位置（新内容用这个） |
|---|---|
| `文档/` | `docs/` |
| `需求/` | `docs/prd/`（按版本分目录） |
| `原型/` | `docs/ui/` |
| `报告/` | `docs/reports/`（测试报告在 `tests/reports/`） |
| `指南/` | `docs/guide/` |
| `经验库/` | 全局 `~/.codex/knowledge/`（项目级坑写本文件"已知坑"） |
| `output/` `screenshots/` `logs/` | `.local/`（不入库） |
| 根目录部署脚本（auto-deploy-*.sh / deploy-all.sh） | `deploy/scripts/` |
| `GIT/`（记录类） | `docs/reports/` |
| `PROJECT_STRUCTURE.md` | 保留，与 `tests/performance/` 并列维护 |
## 原型
- 原型位置：原型/（存量目录，新原型进 docs/ui/）
- 开发对齐：只对齐产品事实（字段/流程/状态/权限/文案）；演示辅助剥离（4 角色演示切换≠真实 RBAC，按登录+权限实现）——原则见全局 AGENTS.md"原型对齐原则"

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

## 测试
- 一键全量：`npm run test:all`（scripts/test-all.sh）；单项 `npm run test:wx-e2e` 等，入口 scripts 见 package.json
- 自动化走微信开发者工具：CLI `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`；skills = wechat-devtools-automator + wechat-auto-test
- 测试数据打 TEST 前缀，测完清理；QA 模拟身份用云函数 env QA_IMPERSONATE=1
- 核心路径清单（regression.sh 必覆盖）：登录→智能录入→录单→分拣→出库→收款→蓝牙打印/转发销售单

## 部署
- 云函数一键部署：`bash auto-deploy-cloudfunctions.sh`（逐个 cli deploy）；CI：ci/upload.js（miniprogram-ci，private.key 在 ci/ 目录，勿外传）
- 云函数改动 → 先部署验证 → 确认无误再视为上线（Serverless 无服务器回滚，回滚=重新部署上一版云函数）
- 发版前：确认 cloudbaserc.json envVariables 未动；发版后冒烟：登录→录单→分拣→出库→收款

## 已知坑（项目级，开工前按关键词检索）
- @cloudbase/node-sdk 的 doc().set(x) 直接以 x 为文档内容；wx-server-sdk 用 {data: x}——两套口径混用会写出 data.data 脏结构（历史已清洗为顶层 flat）
- system 云函数 setConfig：先查后写（存在 update/不存在 add/竞争兜底 update），.set() 对已存在文档会撞 E11000
- ASR 端到端转写 >30s：callFunction 等待放宽；生产走 smart 云函数（timeout 60s）
- node-sdk 写后必须回读验证顶层 key
- 完整历史坑见：~/.codex/knowledge/errors.md（grep 项目名 fenghuai）+ 项目内 文档/编程错误经验.md、经验库/

## 文档权威顺序
PRD_产品需求文档.md > 小程序MVP落地计划与技术架构.md > TDD_技术规格书.md > ERD_数据库设计.md > API_接口文档.md（均在 文档/）

## 工程纪律
- 流程类纪律（commit 时机/push/分支发版/多会话并行/凭据处理）一律以全局 ~/.codex/AGENTS.md【工程纪律】【凭据处理】为准，本文件不复制
