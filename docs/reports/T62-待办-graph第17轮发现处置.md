# T62 fenghuai-trading graph 第17轮发现处置（2026-09-02 产出，来源：graph测试4路并行+独立验证，分支 fenghuai/req-T62-graph-r17）

## 已修（代码已写盘，部署+回归中）

## P1-V1 商品搜索恒 500（_.regexp 不存在）
- 位置：cloudfunctions/products/index.js:54-57
- 做法：改为 db.command.or + db.RegExp 构造搜索条件
- 验收：searchKey 传关键字正常返回列表，无 500
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## P1-V2 collect 不校验 实收+折价≤剩余（可产生僵尸 pending + 脏 total_discount）
- 位置：cloudfunctions/receivable/index.js collect 分支
- 做法：pendingCents 计入 discount；上限校验 toCents(amount)+toCents(discount)>remainingC → 4002
- 验收：剩余 100 时 collect 50+折价 60 → 4002 拒；正常 50+40 通过
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## P2-V5 dashboard timeTab='day' 静默返回 all
- 位置：cloudfunctions/receivable/index.js dashboard
- 做法：加 'day' 分支 = 北京时间今日 00:00~24:00
- 验收：day≠all（今天无单时 day 为空集）
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## P2-V6 exportLedger 日期列输出 "Wed Sep 02"（美式日期）+ 1 处 UTC 时刻慢 8h
- 位置：cloudfunctions/report/index.js（:173 time 列、:623 recvDate 列、:565 UTC 时刻）
- 做法：新增 bjDateStr/bjTimeStr 北京时间工具，三处全改 YYYY-MM-DD / HH:mm
- 验收：导出 Excel 日期列为 YYYY-MM-DD
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## P2-A2 products/getDetail 不存在 ID 裸异常
- 位置：cloudfunctions/products/index.js getDetail
- 做法：try/catch → {code:4004,message:'商品不存在'}
- 验收：不存在 ID → 4004 而非 500
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## P2-A7 12 个 action 未文档化（outbound 5 / import-data 4 / sync-data 3）
- 位置：docs/api/openapi.yaml + docs/api/API_接口文档.md
- 做法：openapi 补 12 paths（共 80 paths，js-yaml 验证通过，3 新 tag）；接口文档计数 31→80 action、10→13 云函数，对照表补 32-43 行
- 验收：js-yaml 可解析 80 paths；文档对照表与 openapi 口径一致
- 状态：已做（T62 修复 commit，部署+回归+test-all 15/15 全绿 2026-09-02）

## 待拍板（人工关卡：动权限模型，不擅自修）

## P1-C1/C2 订单水平越权：u2(orderer) 可 update/delete 非本人订单（DB 已证实）
- 位置：cloudfunctions/orders/index.js update / delete 分支
- 做法候选：方案A=写操作限本人+admin（createdByName 归属校验）；方案B=维持现状（多人协作互改）；方案C=仅 delete 加归属校验
- 风险：A 最严但改变协作语义；C 折中
- 状态：待做（待老板拍板）

## P2-C4 客户水平越权：u2 可 update/delete 非本人客户；客户 delete 无订单引用检查
- 位置：cloudfunctions/customers/index.js update / delete 分支
- 做法候选：同 C1 方案 A/B/C；delete 需加"存在关联订单则拒删"检查
- 状态：待做（待老板拍板，与 C1/C2 一并决策）

## P3 观察项（本轮不修，登记延后）
- P3-1 products/delete 不存在 ID 静默成功 → 应 4004
- P3-2 customers/update 不存在 ID 静默成功 → 应 4004
- P3-3 receivable/customerDetail 空 data 结构不明确
- P3-4 paymentHistory 缺参返全量 → 应校验必填
- P3-5 import-data/sync-data 返回缺统一 code 字段
- P3-6 report/summary 缺参报 5001 → 应 1001
- P3-7 orders/exportSingleOrder 不存在 ID 报 500 → 应 4004
- 状态：待做（下轮或专项处理）

## 回归与收尾（完成记录）
- 修复点回归 tests/t62-fix-verify.js：10/10 PASS（V1 搜索/A2 4004/V5 day/V2 折价上限+pending 含折价/V6 日期）
- 附带修复：tests/data-consistency-audit.js [7] 跳过 pending 待激活邀请账号（无 openid 无权限快照=预期，登录激活时回填，非漂移）

- 3 云函数部署（products/receivable/report）→ 修复点 5 项回归 → test-all 15 步 → QA 钩子关 10/0 → TEST 残留=0 → commit+push
- 状态：已做（test-all 15/15 全绿 EXIT=0；QA 钩子 10/0 关；TEST 残留=0；审计 pending 误报已修）
