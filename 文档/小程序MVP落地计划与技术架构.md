# 丰淮商贸采购下单助手 · 小程序 MVP 落地计划与技术架构实现

> **版本**：v1.0（MVP 定稿）  
> **日期**：2026-08-05  
> **编写**：产品经理（WorkBuddy 协助）  
> **范围声明**：本文档定义 MVP（最小可行产品）的**最终功能范围**，即无二期增强。后续催收闭环、审计日志、趋势报表、微信支付等作为独立升级模块按需追加，机制见 §7。

---

## 〇、MVP 与现有文档关系

- 原型（`原型/丰淮商贸采购下单助手_原型.html`）为功能验证源，本文档为其生产化落地的技术与计划总纲。
- 配套文档（PRD / TDD / ERD / API / 业务流程 / 评估报告 / 用户手册 / 部署运维 / README）均已按本 MVP 范围同步修订。
- 工作量基准：MVP 约 **32 人天**（1 人全栈 6–7 周；2 人并行 4 周）。

---

## 一、MVP 功能清单（最终范围，共 13 项）

1. 四角色登录 + 权限（下单员 / 分拣 / 库管 / 管理员）
2. 新建订单（选客户、商品下拉搜索、数量单价、备注、适老化放大）
3. 订单列表（时间降序、0 元拦截、0件+0个隐藏）
4. 分拣视图
5. 库管（待出库/已出库、商品全显示、打印/转发销售单）
6. 赊销页（客户台账 / 未结清 / 已结清 三栏 + 独立「收款确认」按钮；以客户为单位金额守恒：应收=已收+未结清）
7. 商品管理全角色 CRUD
8. 客户管理全角色 CRUD
9. 销售单模板（西安迈尚、制单人电话取登录人、独立备注列、去 NO.）
10. 全局字号缩放（状态栏 + 我的页，持久化，默认 90%、范围 70%–130%）
11. 0 元订单不计入/不生成
12. 导出中心（报表页含 3 视图 + 3 种 Excel：商品汇总 / 客户汇总 / 收款台账（外县台账格式），入口在「我的」页，全角色可见）
13. 智能录入（文字/语音快速下单）：首页+新建订单页入口，支持文字粘贴/语音录入，智能解析商品/数量/客户，模糊匹配库中数据，多结果时下单员选择，智能记忆上次选择

> 各项字段、交互、校验规则详见 PRD 与用户操作手册；状态机与数据模型见 TDD / ERD。

---

## 二、里程碑排期（约 32 人天）

| 阶段 | 周期 | 内容 | 人天 |
|------|------|------|------|
| W0 准备 | 0.5 周 | 云开发环境、微信认证、商品/客户底表导入 | 2 |
| W1 地基 | 1 周 | 登录 + 四角色权限、商品/客户 CRUD、云数据层 | 8 |
| W2 核心业务 | 1.5 周 | 新建订单、智能录入（文字/语音快速下单）、分拣、库管、收款两步状态机、赊销页（客户台账/未结清/已结清 三栏） | 14 |
| W3 模板与适老 | 0.5 周 | 销售单打印/转发模板、全局字号缩放 | 4 |
| W4 联调上线 | 0.5 周 | 真机调试、蓝牙打印、体验版、审核发布 | 4 |
| **合计** | **约 3–3.5 周开发** | | **≈ 32 人天** |

- 1 人全栈：6–7 周（含文档/联调缓冲）
- 2 人并行（前端 + 云函数）：约 4 周

---

## 三、技术架构实现方案

### 3.1 总体架构
微信原生小程序（前端）+ 微信云开发（后端一体）。
- 云函数（Node.js）处理业务逻辑与权限校验
- 云数据库（文档型）持久化业务数据
- 云存储存模板/附件
- 无需自建服务器、域名、运维；免备案

### 3.2 项目结构
```
/fenghuai-mini
  /miniprogram
    /pages
      login, newOrder, orders, sort,
      warehouse, receivable, products,
      customers, profile
    /components
      productPicker, salesTemplate, fontZoomPanel
    /utils
      stateMachine.js, permissions.js, fontScale.js
    app.js / app.json / app.wxss
  /cloudfunctions
    auth, products, customers, orders,
    users, regions, receivable, system,
    smart, report
  project.config.json
```

### 3.3 云开发环境搭建（含费用）
1. 用营业执照（个体户/公司）注册企业小程序 → 微信认证（个体户 30 元/年，公司 300 元/年）
2. 微信开发者工具 → 开通云开发 → 新建环境（开发期免费，不限时长）
3. 上线前环境转为付费套餐：个人版 **19.9 元/月**（丰淮量小足够）或初创版 99 元/月
4. **不开微信支付**（赊销记账模式），规避 0.6% 流水手续费
5. 首年平台费：个体户 ≈269 元 / 公司 ≈539 元

### 3.4 数据模型（云数据库集合，MVP 字段）

共 **11 个集合**：`users` / `regions` / `products` / `customers` / `orders` / `order_items` / `payments` / `product_aliases` / `customer_aliases` / `order_logs` / `system_config`。

- **users**：`_openid, role, name, phone, region, fontScale, status, invitedBy, createdAt`（**微信原生身份模型，openid 即唯一身份，MVP 不设置密码**；`status` ∈ pending/active/disabled，`invitedBy` 记录邀请人，便于溯源。原 PRD 的 `password_hash`/bcrypt 二次校验在微信原生场景下作废，已与用户确认 MVP 去掉）
- **regions**：`name, sort, status`（预置 11 条：汉滨区(1)、汉阴县(2)、石泉县(3)、宁陕县(4)、紫阳县(5)、岚皋县(6)、平利县(7)、镇坪县(8)、旬阳市(9)、白河县(10)、外县(99)，无 code 字段）
- **products**：`_id, material_code, name, spec, pinyin, unit_piece, unit_bag, price_piece, price_zero, category, status, usage, remark, is_adjustable`（包价/包数字段采用 `price_zero` / `zero_qty` 命名，与 PRD 一致）
- **customers**：`_id, name, region, phone, contact, address`
- **orders**：`_id, no, customer, items[], amount, time, status, recvView, payment_status, createdBy, remark`
  - `items[]`: `{material_code, name, spec, piece_qty, bag_qty, price_piece, price_zero, remark, amount}`
- **order_items**：订单明细（`order_id, product_id, sku_code, seq` 等）
- **payments**：`_id, orderId, amount, operator, time, status(pending/confirmed)`（收款登记→确认两步，`status` ∈ pending/confirmed）
- **product_aliases**：商品别名（智能录入模糊匹配用）
- **customer_aliases**：客户别名（智能录入模糊匹配用）
- **order_logs**：订单操作记录（创建/编辑/删除/收款/分拣/出库留痕）
- **system_config**：系统配置（AI 服务密钥、打印机配置）
- 预留字段（升级用，不破坏老数据）：`orders.reportFields`, `users.regionPerm`

### 3.5 订单状态机（简化主线：新建即入待分拣 → 已分拣 → 已出库 → 已完成）
```
新建订单即入 SUBMITTED(待分拣)
   ├─ 分拣员·处理分拣(sort:task) → SORTED(已分拣)     ← 一键完成
   └─ 库管·出库确认(warehouse:confirm) 作用于 SORTED → CONFIRMED(已出库) → DONE(已完成)
赊销收款：unpaid(未收款) → pending(待确认·已登记) → paid(已收款)
收款两步：登记 payment(pending) → 确认 payment(confirmed) → payment_status=paid
```
> 流水线：① **分拣段** 待分拣 → 已分拣（一键完成，无"分拣中"中间态）；② **出库段** 待出库(已分拣) → 已出库（库管一步确认）。两段合并在「分拣出库」页内切换（见 §3.9）。`sort:task` 控制"处理分拣"权限、`warehouse:confirm` 控制"出库确认"权限，可在「成员管理-权限配置」中按角色开关（默认全员开放）。
状态转换在云函数 `order` 内集中校验；前端仅触发动作，不直接改状态。无"保存草稿"、无"手动取消"动作；`DRAFT`(草稿)、`CANCELED`(已取消)、`REJECTED`(已驳回·必填原因) 状态**保留定义但当前流程不触发**（遗留/二期规划，不纳入主流程）。

### 3.6 赊销金额计算（三栏 + 已收口径）
```
未结清(o) = o.amount − 已收(o)       其中 已收(o) = Σ(confirmed payments.amount)
```
赊销页以客户为单位聚合总账：**应收总额 / 已收 / 未结清**（金额守恒：应收 = 已收 + 未结清）；**客户台账 / 未结清 / 已结清**三栏由 `recvView` + 时间过滤驱动（与 PRD §4.3.7 一致）；客户与内部订单均按 `time` 降序。用「已收」(含部分收款/折价) 统一替代原「已结清」口径，台账/汇总/导出三处一致。

### 3.7 角色权限模型（开放 + 可配置）

**四角色**：下单员 / 分拣员 / 库管 / 管理员。
**核心原则（2026-08-05 用户定稿）**：
1. **全员开放**：除下方明确分工外，4 个角色对所有功能拥有同等权限——均可新建/修改/删除订单、查看全部订单、打印/转发、商品与客户全 CRUD、导出中心（3 种）、查看赊销页（客户台账/未结清/已结清）、分拣、出库。
2. **赊销收款两步分离（唯一分工点）**：`登记收款`（填写金额并确认）限 下单员 / 分拣员 / 管理员；`确认收款`（确认金额）限 库管 / 管理员。库管不可登记、下单员与分拣员不可确认，避免一人包办、形成内部制衡。
3. **成员管理独占**：用户/角色管理（邀请、分配角色、启用停用）仅管理员可操作。
4. **权限可配置**：管理员可随时调整任意角色的任意权限开关，运行时即时生效（见 §3.7.2）。

权限在**前端路由守卫 + 云函数入参校验**双层生效——前端仅控制 tab/按钮显隐，真正的写操作闸门在云函数按 `ctx.openid` 查 `users.role` 对应的 `DEFAULT_ROLE_PERMISSIONS[role].permissions` 校验，越权直接拒绝。

> 原型「成员管理 → 权限配置」即按下列细粒度分组逐项开关；默认全员开放，仅「赊销两步分离」与「成员管理独占」为分工/锁定项。

| 模块 | 功能（权限 key） | 下单员 | 分拣员 | 库管 | 管理员 |
|------|------|:----:|:----:|:----:|:----:|
| 订单管理 | 新建订单 `order:create` | ✅ | ✅ | ✅ | ✅ |
| 订单管理 | 编辑订单 `order:edit` | ✅ | ✅ | ✅ | ✅ |
| 订单管理 | 删除订单 `order:delete` | ✅ | ✅ | ✅ | ✅ |
| 订单管理 | 打印/转发 `order:print` | ✅ | ✅ | ✅ | ✅ |
| 订单管理 | 导出订单 `order:export` | ✅ | ✅ | ✅ | ✅ |
| 商品管理 | 查看商品 `product:view` | ✅ | ✅ | ✅ | ✅ |
| 商品管理 | 商品维护(增改删) `product:edit` | ✅ | ✅ | ✅ | ✅ |
| 客户管理 | 查看客户 `customer:view` | ✅ | ✅ | ✅ | ✅ |
| 客户管理 | 客户维护(增改删) `customer:edit` | ✅ | ✅ | ✅ | ✅ |
| 分拣作业 | 处理分拣 `sort:task`（一键完成） | ✅ | ✅ | ✅ | ✅ |
| 库管出库 | 出库确认 `warehouse:confirm` | ✅ | ✅ | ✅ | ✅ |
| 赊销收款 | 查看赊销页 `receivable:view` | ✅ | ✅ | ✅ | ✅ |
| 赊销收款 | 登记收款 `receivable:collect` | ✅ | ✅ | ❌ | ✅ |
| 赊销收款 | 确认收款 `receivable:confirm` | ❌ | ❌ | ✅ | ✅ |
| 赊销收款 | 折价/减免 `receivable:discount` | ✅ | ✅ | ✅ | ✅ |
| 报表中心 | 查看报表 `report:view` | ✅ | ✅ | ✅ | ✅ |
| 报表中心 | 导出报表 `report:export` | ✅ | ✅ | ✅ | ✅ |
| 报表中心 | 收款台账 `report:ledger` | ✅ | ✅ | ✅ | ✅ |
| 系统管理 | 成员管理 `member:manage`（锁定） | ❌ | ❌ | ❌ | ✅ |
| 系统管理 | 调整各角色权限 `permission:manage` | ❌ | ❌ | ❌ | ✅ |

> 与 PRD §4.2 / §4.3.7 一致：细粒度分组后默认全员开放；商品/客户全角色 CRUD、赊销收款权责分离（下单员/分拣员登记 → 库管确认）、赊销 Tab 与导出中心全角色可见；`member:manage` 固定管理员独占（防锁死）。

### 3.7.1 身份与成员接入（微信原生设计，2026-08-05 定稿）
- **身份锚点 = openid**：`wx.login` → code → 云函数换 `openid`，作为 users 唯一键，**无需用户名/密码**。
- **首管理员（方案 A·零配置）**：系统首次启动无任何管理员时，**第一位登录者自动成为 `role=admin`**（`login` 云函数检测 `users` 中无 `role=admin` 即自动赋值），老板部署后直接用微信打开小程序登录即可，无需配置任何环境变量、也无需先知道 openid（解决"谁分配第一个管理员"的鸡生蛋问题）。如需在有人登录前预置管理员，可用「可选兜底（方式二）」：在云开发环境变量 `ADMIN_OPENID` 写入老板 openid（非必填）。
- **成员接入双通道（并存）**：
  1. **邀请制（主）**：管理员在「成员管理」填姓名/电话/区域 + 选角色 → 云函数生成**专属邀请码/二维码** → 员工微信扫码，`openid` 自动绑定到该预建记录并激活（`status: pending → active`）。
  2. **自助审核（兜底）**：员工直接微信登录 → 系统建 `status: pending` 记录 → 管理员在「待分配」列表手动选角色激活。
- **角色变更 / 停用**：管理员可在成员管理改 `role` 或置 `status: disabled`（禁用后云函数拒绝其所有写操作）。

### 3.7.2 权限可配置（管理员随时调整各角色权限）

权限**不是写死的常量**，而是存储在 `users.role` 对应的 `DEFAULT_ROLE_PERMISSIONS[role].permissions` 权限开关（与原型一致，非独立集合）。管理员在「成员管理 → 权限配置」页对 4 个角色分别勾选/取消权限，保存后**即时生效**——下一次云函数校验即按新配置放行或拒绝。

- **默认种子**：首次部署由云函数 `init` 写入 4 条权限初值 = §3.7 矩阵（全员开放 + 赊销两步分离 + 成员管理独占）。
- **校验链路**：云函数 `orders` / `products` / `customers` / `receivable` / `report` 入口统一调用 `checkPerm(openid, 'order:create')` → 查 `users.role` → 查 `DEFAULT_ROLE_PERMISSIONS[role].permissions` 是否含该 key → 不含则抛 403。
- **权限 key 约定（细粒度，与原型 `DEFAULT_ROLE_PERMISSIONS` 一致）**：`order:create` `order:edit` `order:delete` `order:print` `order:export` `product:view` `product:edit` `customer:view` `customer:edit` `sort:task` `warehouse:confirm` `receivable:view` `receivable:collect` `receivable:confirm` `receivable:discount` `report:view` `report:export` `report:ledger` `member:manage` `permission:manage`。按模块分组见 §3.7 矩阵。
- **防锁死**：`permission:manage` 与 `member:manage` 仅管理员默认拥有，且云函数对这两个 key 做硬校验（即便权限配置被误改，管理员始终保有权限，不会被自己锁死）。

### 3.8 云函数划分
| 函数 | 职责 |
|------|------|
| auth | 微信登录(openid) → 查/建 users → 绑定 role；支持邀请码绑定（扫码写入 openid）；**首管理员零配置**：检测无 admin 即把首位登录者自动设为 `role=admin`（可选兜底：环境变量 `ADMIN_OPENID` 预置）。**无密码校验**（微信原生身份） |
| products | 商品 CRUD + 搜索 |
| customers | 客户 CRUD + 搜索 |
| orders | 建单（0元拦截）、状态流转、列表过滤（0件0个隐藏、时间降序）、收款登记/确认、备注、打印标记、操作记录 |
| users | 用户增改/分配角色/启用停用（微信原生，无密码） |
| regions | 区域增改 |
| receivable | 赊销看板/应收查询 |
| system | 系统配置（AI 服务密钥、打印机配置）、SLA 定时任务、数据备份 |
| smart | 智能录入：文字/语音解析、商品/客户模糊匹配、智能记忆 |
| report | 报表/导出（3 种 Excel 导出） |

### 3.9 前端架构
- 底部 tab 切换（微信 tabBar 上限 5 个）：**首页 / 订单 / 赊销 / 分拣出库 / 我的**；按 §3.7 开放模型，4 角色全部可见同一套 Tab（不含按角色隐藏）；任一角色若被管理员关闭 `receivable:view` / `sort:task` / `warehouse:confirm` 等"查看/操作类"权限，对应 Tab 自动隐藏（运行时即时生效，见 §3.7.2）。
- **导出中心入口**：置于「我的」页（全角色可见），报表页含 3 个视图 tab（商品汇总 / 客户汇总 / 收款台账），并提供 3 种 Excel 导出（报表明细 / 客户汇总表 / 收款台账（外县台账格式）），不单独占底部 tab —— 规避微信 5-tab 限制，同时保留 PRD 的"报表/导出"能力。收款台账字段规则：正价货 = pricing_mode=piece 金额合计；损赠特 = pricing_mode=unit(zero/bag) 货损金额合计；实际货值 = 正价货 − 损赠特；赊销 = 实际货值 − 实收；件数 = 大件+中件+小件；总件数 = 物流件数合计（底部蓝色合计）
- **全局字号**：CSS 变量 `--font-scale`（rpx 体系），状态栏"字"按钮 + 我的页入口，存 `users.fontScale` 持久化；**默认档 90%**（与原型 `--font-scale:0.9` 一致，范围 70%–130%）
- 商品下拉：`productPicker` 组件，可搜索、常购优先
- 适老化：数量/单价输入框字体放大

### 3.10 打印方案
- **蓝牙打印**：小程序 `wx.openBluetoothAdapter` + ESC/POS 指令输出销售单/送货单（机型确定后实测：芯烨/佳博/汉印）
- **微信转发（两种场景，均已纳入 MVP）**：
  - 库管「打印/转发销售单」：西安迈尚销售单模板渲染为图片/PDF，`print` 云函数生成后转发聊天或保存相册
  - 下单员「转发客户微信」：订单明细卡片（含商品/数量/金额/未付款状态，无收款码），经 `onShareAppMessage` 转发给客户微信好友核对
- 模板统一用**西安迈尚版**：去 NO.、制单人电话自动取登录人、金额后独立备注列

### 3.11 数据迁移
商品/客户底表（xlsx）→ 解析脚本 → 批量写入云数据库 `products` / `customers` 集合（上线前一次性导入）。

### 3.12 上线流程
开发者工具上传代码 → 体验版（加白名单真机试用）→ 提交审核（1–3 工作日）→ 发布。

---

## 四、客户费用（年平台费）

- 认证：个体户 30 / 公司 300 元/年
- 云开发：个人版 19.9×12 ≈ 239 / 初创版 99×12 ≈ 1188 元/年
- 微信支付手续费：0（不开通）
- 短信/域名/服务器：0
- **首年合计**：个体户 ≈269 / 公司 ≈539 元（极限最低）；务实推荐初创版 ≈1488 元

---

## 五、升级机制（后续）

代码层（云函数/前端）与数据层（云数据库）**解耦**。升级 = 覆盖发布代码层，数据层原样保留；加字段向后兼容（老文档缺字段返回默认）；可灰度、可一键回滚。即"升级只加功能，历史订单/客户/欠款全在"。

---

## 六、风险与决策门

- **打印机型未定**（芯烨/佳博/汉印）→ 影响 W4 真机调试，需客户确认
- **收款状态机须一次做对**（赊销欠款额全依赖它，数据命门）
- 角色权限在 W1 设计成可配置，避免后续返工
- **底部 tabBar 限制**：微信小程序底部 tab 上限 5 个，已采用「首页/订单/赊销/分拣出库/我的」5 个 Tab（分拣与库管合并为「分拣出库」）+ 「我的」页内导出中心入口，规避超限（不单独设报表 tab）

---

*本文档为 MVP 落地总纲，与 PRD / TDD / ERD / 工期评估 / 部署运维 配套使用。*
