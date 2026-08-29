# 变更日志 (Changelog)

本项目所有重要变更均记录在此文件中。

格式基于 [Conventional Changelog](https://www.conventionalcommits.org/)。

## [1.7.0] - 2026-08-30

### Fixed (T53: graph测试 4 路全角度测试 + 独立验证 + 修复)

**P1 状态机穿透（B-3/V-1，已独立复现）**
- orders 云函数 confirmSort/confirmOut 补终态守卫：已取消/已完成订单被 3002 拒绝（单条+批量模式），堵住"已取消订单经 confirmSort/confirmOut 双通道复活进入出库流"的穿透（原仅 update-status 有守卫）

**P2 修复（独立复现确认）**
- confirmOut 幂等守卫（B-2/V-2）：已出库订单重复 confirmOut 不再静默覆盖 ship 件数，返回 alreadyOutbound+当前件数（防库单导出被污染）
- 3 个列表页补加载态指示（D-1/V-4）：orders 补 loading 位+wx:if 指示；reports/outbound 接线已存在但 wxml 从未引用的 loading 死状态位
- 日志脱敏（C-4/V-9）：auth 云函数 openid 截断前 6 位、inviteCode 不打印（PII/邀请码不进云函数日志）
- CI 供应链加固（C-1/V-7）：actions/checkout 与 actions/setup-node 从可变 tag @v4 pin 到 commit SHA
- outbound「⏰ 模拟16:00通过」改名「⏰ 立即执行定时确认」（D-2/V-5，原型演示辅助残留文案，功能=真实立即执行）
- new-order 未选客户副文对齐原型「点击选择客户信息」（D-3/V-6）

**测试基建**
- 新增 tests/order-state-guard-test.js（T53 防回归，12 断言：合法流不误伤/cancelled 双通道拒绝/重复出库幂等+件数守恒，纯 node-sdk 不占模拟器），挂 test-all 第 7 步（全量 11→12 步）
- 误报关闭 1 项：init-database/init-db-auto execSync 变量参数（参数源=脚本内硬编码常量，无用户输入通路）
- 观察项 2 项（偶发未复现，不立卡）：deepwalk tab 切回、pagewalk members 截图 bytes=-1（重跑均绿）

**未修·待用户拍板（人工关卡）**
- B-1/V-3（P2）折价 pending 窗口台账口径：collect 登记折价后未 confirm 期间，客户台账"已收"不含该笔待确认折价/实收（窗口内显示全额未结清）。当前口径守恒不破（应收=已收+未结清恒成立），但财务看板窗口期内偏保守。方案 A=台账"已收"含 pending 部分并标注"含待确认"；方案 B=维持现状加 pending 提示行。涉及财务展示语义，待用户定

## [1.6.9] - 2026-08-27
## [1.6.9] - 2026-08-27

### Removed (T52 P3-1: regions 集合历史脏数据清除，用户拍板)
- 删除 regions 集合全部 12 条记录（data.data 嵌套脏数据 + 1 条 {status:1} 孤儿）；删除前全仓核验无任何业务链路读取（regions 云函数无调用方 / customers 内部 action 前端不消费 / 报表区域选项来自订单快照），客户区域数据独立存于 customers.region 不受影响
- 留痕：全量备份入库 docs/reports/backups/regions-删除前备份-20260827.json；清洗脚本入库 scripts/cleanup-regions-20260827.js（幂等，可重复执行）
- 复核：删除后 count=0、幂等重跑退出 0、数据对账审计 12 项全绿

---

## [1.6.8] - 2026-08-27

### Added (T52: 全业务数据对账 + 文档代码对齐，来源用户"全业务/页面/算账报表/权限流程全检查")
- 数据对账审计脚本固化：tests/data-consistency-audit.js（只读零写入，8 组断言：总额vs明细/实收vs确认收款/状态一致性/孤儿收款/取消单合理性/逐客户赊销守恒/权限快照vs矩阵/引用完整性+0元单+料号唯一），挂 test-all 第 1 步常设回归
- 首轮生产对账全过：订单 1/收款 0/客户 282/商品 167，无漂移无孤儿无越权

### Fixed
- API 文档与代码/生产数据字段不一致 14 处（商品段 sku→material_code、订单段 snake_case→camelCase、客户段 region_id 外键→region 名称、区域段调用路径）——按生产数据实际 KEYS 重写，杜绝"文档契约"误导后续开发

### Verified
- regions 集合 data.data 嵌套历史脏数据登记 P3 观察（无业务链路消费，不修）
- 商品「调货」(material_code=93) 0 价占位确认业务设计（is_adjustable 人工改价），非 bug

---

## [1.6.7] - 2026-08-27

### Fixed (T51: 动钱核心加固 + 全仓截断清零，来源用户"其他有 bug 的全修")
- T51-1 [P1]: 订单总额改服务端重算——create/update 原直接信任前端 totalAmount 入库（与"服务端重算、不信任前端"文档口径矛盾），现改为明细行金额求和后分位取整，前端值仅作 0 元快速拦截
- T51-2 [P1]: 全仓 100 条截断清零——orders（列表/工作台/自动确认/批量确认/客户欠款×2/导出/todayStats）、outbound（3 列表）、smart（匹配/解析候选×3，生产 167 商品+282 客户已触顶、智能匹配正在漏匹配）、system（白名单姓名匹配）、report（trend）共 15 处统一 fetchAll 分页拉全量；todayStats/trend 金额改分位整数累加

### Verified
- T50-8 决策关闭：用户拍板保留四角色订单删除权，T50-3 已确认收款禁删兜底
- 全仓 rg 复查：财务聚合/列表/批量/候选查询无裸 .get() 残留；doc().get 与显式 limit 列表语义合法保留

---

## [1.6.6] - 2026-08-27

### Fixed (T50: 三轮猎杀审计——全角色流程 + 赊销财务逐行审计发现处置)
- T50-1 [P1]: 财务汇总查询补全量分页——receivable（dashboard/customerDetail/attachConfirmedPayments）与 report（summary 三 tab/main + payments 台账 + 2 处 in(ids) 关联）共 8 处聚合查询原默认截断 100 条，订单数 >100 后应收/已收/未结清/报表统计静默少算；现统一 fetchAll 分页拉全量（批次 100 防 1MB 响应上限）
- T50-2 [P1]: 确认收款改条件更新（where _id+status=pending）防并发双记——原 get→update 两步非原子，并发可双翻 confirmed 覆盖确认人/审计轨迹
- T50-3 [P1]: 删除订单资金红线拦截——存在已确认收款记录的订单禁止物理删除（原级联销毁收款轨迹、应收凭空减少）；查询失败保守拦截；级联清理只删 pending；前端删除入口对已收款订单隐藏
- T50-4 [P2]: orders/update-status 补状态机——原为任意状态裸写（死接口敞口，前端不调用）；现合法前向流白名单 + 取消仅 admin + 必填原因 + 留痕
- T50-6 [P2]: API 文档收款链路纠错——实际收款在 receivable/collect + receivable/confirmPayment（非 orders/collect）；6.7/6.8 参数段与代码事实完全不符已按代码重写

### Verified
- 三轮审计范围：receivable/orders/report 全量源码 + 权限链路（perm_configs→user.permissions 快照同步）+ 前端调用链 + wx-server-sdk 默认 limit 源码核实（tcb-admin-node query.js L66=100）
- 误报撤销 1 项：orders checkPermission 已接 QA 身份钩子（审计看漏）
- 待拍板：order:delete 默认矩阵是否收紧仅 admin（T50-8，未动代码）

---

## [1.6.5] - 2026-08-27

### Fixed (T49: 二轮深度审查发现处置)
- T49-1: API 文档 §1.4 错误码表补登记 4001/4002/4004/5002/5003 语义 + 2001 历史兼容注（代码不改，兼容纪律；前端仅 code===0 二分支无感）
- T49-2: sync-data 云函数 package.json name 残留修正 import-data → sync-data（纯元数据，不重新部署）

### Added (T42: 专业角色资产补建)
- T42-1: 建成 docs/runbook/线上事故处置runbook.md（P0-P3 分级 + 6 类故障处置清单 + 云函数/小程序双回滚 + QA 残留应急 + 事后闭环）
- T42-2: 建成 docs/api/openapi.yaml（OpenAPI 3.0.3，35 接口 = 31 核心 action + getInviteCode + 权限矩阵 3 接口；swagger-cli validate 通过，与 API 文档 action 全量核对无缺失）

### Verified
- 二轮深度审查结论：无 P0/P1。SAST semgrep 12 项全 P3 豁免（登记于 T49 卡）；权限矩阵/状态机/金额守恒/赊销两步/0 元订单拦截/主包体积/线上与本地一致性核查全部通过
- 二轮全量回归 11 步全绿（单测/权限/页走查/深走查/部署/E2E/会员/幂等/关钩子/QA 残留校验），收尾确认生产安全态

---

## [1.6.4] - 2026-08-27

### Changed (T48: 项目审查发现处置，来源 2026-08-27 全量审查)
- T48-1: 项目 AGENTS.md 全局规则依赖版本 v4.20→v4.21（与全局规则对齐，commit db32520）
- T48-2: 补齐 6 个云函数（smart/outbound/auth/users/system/regions）package-lock.json，落实"lockfile 必入库"纪律；依赖漏洞豁免登记入 T48 卡（wx-server-sdk 平台约束 / xlsx 0.18.5 无 npm 修复版 / miniprogram-ci 纯 CI 工具链）（commit f119c7f）
- T48-3: tests/qa-toggle.js 云函数部署瞬态失败（COS 上传 60s 超时，当日 products 实例）自动等 10s 重试 1 次；重试仍失败则 on/off 退出码非 0，set -e 阻断 test-all 防止带病进入后续步骤

### Verified
- 全量回归 test:all 11 步全绿（审查时基线，19/12/24/28/23/56/10 失败 0，QA 残留校验通过）
- node --check tests/qa-toggle.js 通过；badarg 退出码 1；status 只读命令线上 10 函数 QA_IMPERSONATE 全空（生产安全态）
- 6 个新 lockfile 均锁 wx-server-sdk 2.6.3（与既有函数一致）；package.json 零改动（diff 验证）
- check:perms 通过

## [1.6.3] - 2026-08-24

### Changed (T46: 报表汇总卡口径 + 两处 UI 对齐原型)
- 报表汇总卡与 tab 解耦：新增 report 云函数 reportTab=main 口径，顶部"订单总数/总金额"始终=所选时间段(今日/本周/本月/自定义)内订单总数与订单总金额，不再随商品/客户/收款台账 tab 切换变化（此前切到"收款台账·今日"因当日无收款记录显示 0，口径误导）
- 赊销页"收款确认/导出"两按钮对齐原型：同 12px 字号、同 14px 圆角、同高、左对齐紧挨（去除导出按钮 margin-left:auto 右推与 26rpx 渐变差异）
- 分拣出库"分拣完成"按钮：原生 button 改 view，消除默认 width:100% 撑破卡片盖住右侧商品框的溢出

### Verified
- report 云函数本地 node-sdk 实测：今日 Date-range 命中 20260824-0001(1笔/272元)、本周命中 1 笔，main 口径守恒
- report 云函数重新部署成功（DEPLOY_EXIT=0，packSize 23.6MB）
- 全部改动 node --check 语法通过，git diff 自审无调试残留

---

## [1.6.2] - 2026-08-24

### Fixed
- 真机语音录入 start record fail：wx.authorize 参数误写 scope record 前缀错误导致授权被静默吞掉，录音器 start 必失败；补 app.json permission 声明与拒绝后去设置入口(openSetting)
- 客户台账同名两张卡：8/13 三笔订单 customerId 指向旧导入批次孤儿 ID，与 8/24 新 ID 裂成两卡；执行幂等迁移 scripts/migrate-repoint-orphan-orders.cjs 重挂 3 笔(迁移前备份 docs/reports/_backup_*_20260824.json，守恒 8/8)
- 报表本周 0 单/收款台账空：部署的 report 云函数为 T42 前旧版；重新部署 report(北京时间周界修复+收款台账 confirmed 口径)

### Verified
- 台账聚合终验(云端同口径重算)：4 家客户，应收 1500.52/已收 75.00/未结清 1425.52，逐客户守恒全 OK
- 生产 CI 上传 1.6.2：miniprogram-ci UPLOAD_OK，zip 270679 字节 / 54 文件

---

## [1.6.1] - 2026-08-24

### Fixed
- **IDE 上传主包 80051 超限(3264KB)**：根因是微信开发者工具按 appid 缓存的文件清单快照停在 T30 之前(当时 packOptions.ignore 尚无 output/screenshots)，把这两个测试产物目录打进主包(3264KB=pages+output+screenshots 精确字节和)；生产 CI 通道 miniprogram-ci 独立 ignores 不受影响(270KB)。根治：回归截图 wx-pagewalk OUT_DIR 改写 .local/output(已被 gitignore)，根目录残留产物移入 .local/regenerable-artifacts/ 保留；此后产物不再落根目录。IDE 侧可 cli cache clean -c file --project <p> --port <port> 清文件缓存后重开项目恢复注册

### Verified
- 生产 CI 上传 1.6.1：miniprogram-ci UPLOAD_OK，zip 270319 字节 / 54 文件；主包真实代码体积 544KB(<2MB 上限)

---

## [1.6] - 2026-08-24

### Added
- **语音/文字智能录入方言适配**：本地方言口述 + ASR 同音字容错——中文数字量词（两/三/十二/二十）、罕见 ASR 错字→商品标准字单向归一（白吉魔→白吉馍、菜角→菜饺）、整句无空格滑窗匹配、一行多商品按"商品后优先就近"量词配对；AI/TokenHub 提示词增加方言说明。商品名内数字（400克晶纯盐）不误判为数量。单测 tests/smart-dialect-test.js 16/16，全库 167 商品名自匹配 100%

### Changed
- **折价/货损全员可填**：移除赊销收款弹窗与订单详情收款弹窗的 receivable:discount 前端门控（权限矩阵本就 4 角色全开），hint 文案改为「如货品损坏折扣，确认入账后按最终价计入」

### Fixed
- **smart-ai 测试回归**：f2ae385 给 parseWithAI 加权限校验后测试 mock 无 OPENID 被 401 拦截（4/4 全挂）；wx-server-sdk-mock 支持 __SMART_OPENID__ 身份 + users 集合 where 查询；已下线的千问(qwen)降级用例更新为 TokenHub 链路（降级链 = relay -> tokenhub）
- **报表导出内层身份丢失**：report 云函数 export 内递归调 summary 时重置 __impersonatedOpenid 为空 → QA 链路下导出 CSV 仅表头无数据行；内层透传 qaAsOpenid（生产真实用户走 WXContext 不受影响）
- **收款台账导出标题**：timeTab=all 时 rangeDesc 输出「undefined 至 undefined」，补「全部」档（exportLedger/exportDailySummary 两处）
- **清理历史测试脏数据**：删 1 条 08-20 data.data 脏结构测试订单 + 3 个 QA 测试用户（备份 docs/reports/_backup_20260824_pre_cleanup.json，已 gitignore）；e2e 三算账脚本补 QA 身份注入（此前生产态全 401 无法回归）

### Verified
- 全量回归 11 步全绿（172 断言 0 失败）：权限 19/权限UI 12/走查 13/深巡 24/多角色403 28/E2E 23/会员 56/幂等 10 + QA 残留门禁通过，生产安全态；金额口径复核：剩余欠款 = 订单金额 − 实收 − 折价（分级整数计算），实收达最终价即结清，看板/CSV/Excel 导出同源
- T42 上线前算账专项（2026-08-24 第二轮）：收款 9/9（结清拦截/分笔占额/确认转 paid/实收折价落库）、时间段报表 11/11（客户视图总额==订单和、CSV 导出金额和==订单和、出库导出三范围）、0 元红线 9/9；总账口径抽查：台账/未结清/已结清三视图 + 逐客户 应收=已付+未付 守恒 diff=0（应收 1228.52/已付 75/未付 1153.52）；全量回归 11 步 185 断言 0 失败，生产安全态门禁通过

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
