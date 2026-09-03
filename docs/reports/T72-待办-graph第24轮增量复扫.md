# T72 · R24 graph 测试：增量复扫（第 24 轮）

- **状态**：已做（R24 收尾，见 commit 记录）
- **日期**：2026-09-03
- **触发**：老板指令"使用 graph 测试再过一遍"
- **测试方式**：增量制 v4.31（R23 无代码修复 → 存量回归 + 澄清点真实语义复测 + 新角度抽样 + 独立验证）

## 结论

**发现并修复 1 个真实 bug（P2 审计字段空）+ 2 处测试脚本断言口径错；无 P0/P1，可投放。**

## 存量回归（无代码改动先跑，全部通过）

| 步骤 | 结果 |
|---|---|
| check:perms 权限矩阵 | ✅ 一致 |
| data-consistency-audit 对账 | ✅ 12/12 |
| perm-logic-test | ✅ 22/22 |
| orders-qty-limit-test | ✅ 12/12 |
| csv-injection（QA 钩子开后） | ✅ 13/13 |
| deep-chain-cross（收款/报表/台账三口径守恒） | ✅ 15/15 |
| e2e-zero-value（0 值边界） | ✅ 9/9 |
| e2e-receivable（两步收款+超收拦截） | ✅ 9/9 |
| perf-baseline | ✅ 零错误，P95 告警（环境负载，P50 正常） |

## 发现与修复

### Bug 1（P2）：receivable confirmPayment/collect 审计字段空（真实 bug，已修复）

- **现象**：QA impersonation 模式下确认收款，payments.confirmed_by 落空串（生产 raw OPENID 正常）
- **根因**：3 处审计字段（confirmed_by / registered_by / paymentConfirmedBy）直用 `cloud.getWXContext().OPENID`，未走同文件 checkPermission 的 `__impersonatedOpenid || raw` 口径
- **影响**：生产环境无影响（真实小程序调用 OPENID 一定有值）；仅 QA 测试模式审计链路不完整
- **修复**：3 处统一改 `__impersonatedOpenid || (cloud.getWXContext() || {}).OPENID || ''`
- **部署**：receivable 云函数已重新部署；独立验证 r24diag6.cjs 复测 confirmed_by 正确落库管理员 openid
- **红线核查**：属审计字段补全（防御性），不改变金额/状态/权限逻辑

### 口径修正 1：e2e-timerange 假 FAIL（客户视图 0 vs 期望 100）

- **根因**：测试造单只传 customerName 未传 customerId → report customer tab 的"无 customerId 孤儿订单不参与聚合"脏数据防护正确返回 0；期望值却把孤儿单算进去
- **修复**：脚本改为先建真实客户+传 customerId（T72 注释），清理段同步补删客户；复测 11/11 全绿
- **产品语义核实**：脏数据防护本身正确（孤儿订单不应进入客户维度聚合报表）

### 口径修正 2：wx-perm-test 邀请清理断言过严

- **根因**：断言"全表 pending 邀请=0"，但 2026-09-02 存在历史/业务真实邀请（非本轮测试造）不应误删
- **修复**：断言改"本轮创建的已全部清理"（比对 docId），复测 15/15 全绿

### 口径修正 3：order-state-guard 用户清理缺失

- **根因**：QA_orderer 测试用户造后未清 → data-consistency 用户权限快照漂移 FAIL
- **修复**：finally 段补 `users.where({openid:QA_ORDERER}).remove()`；复测 16/16 全绿

## 上轮澄清点真实语义复测（独立探针 r24verify.cjs）

11/11 全过：paymentHistory 三态（缺参 1001/带参返回/跨客户隔离）· confirmPayment + confirmed_by 落库 · 重复确认幂等不重复入账 · 超收拦截 · save-perm 签名 · perm-config 生效

## 环境问题（复发，已记经验库）

- QA toggle 后台 nohup 进程静默退出（0/10 或部分开）；需前台轮询循环重拉
- qa-toggle status 部署窗口计数抖动（10→9→7→5→1→0 稳定）；须等稳定后判

## 收尾

- TEST_R24/R23/区间测试客户 残留全清，生产基线恢复：orders=1（丰淮商贸-20260826-0001）/ customers=282 / products=167 / payments=1（508 confirmed，确认人 admin）/ users=2
- data-consistency 12/12 全绿
- QA 钩子 0/10 关闭（等待部署窗口稳定后确认）
- 改动文件：cloudfunctions/receivable/index.js（+7/-3）· tests/e2e-timerange-test.js（+7/-1）· tests/order-state-guard-test.js（+2）· tests/wx-perm-test.js（+2/-1）

