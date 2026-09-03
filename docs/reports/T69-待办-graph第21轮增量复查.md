# T69 — graph 第21轮（R21）增量复查（v4.31 增量测试制）

- **日期**：2026-09-03
- **模式**：多轮连测增量制——上轮修复点（T68 0件0包行）+ 受影响模块（orders create/update/detail/list/导出/打印链路）+ 末轮关键不变量抽测；存量由 test-all 全量回归覆盖
- **环境**：QA 钩子 10/10 开测→10/10 关测（生产安全态）

## 结论

**未发现新 bug。** R21 探针 3 个"失败"全部为探针自身问题（独立验证已澄清）；独立验证 9/9 有效断言全绿。

## 探针失败项澄清（均非 bug）

1. orders export excel 1001：orders 云函数无 'export' action（未知 action 返回 1001），探针假设了不存在的接口；订单导出真实入口=exportSingleOrder（PNG）✅
2. orderer/warehouse 401：探针用不存在的 users action（addMember）建临时成员失败→身份不存在 401；独立验证按 wx-role-sim 同法（直接写 users 文档+默认权限）重跑，权限边界全对
3. exportSingleOrder fileID 断言：断言字段名错，真实返回=csvContent+filename（销售单文本），内容正确（0件0包行未出现在打印文本）

## 独立验证（V1-V3，与探针分离）

| 项 | 结果 |
|---|---|
| V1 orderer confirmPayment 403 / warehouse collect 403 / admin 放行 | 3/3 通过 |
| V2 exportSingleOrder / report export product excel / outbound exportOutbound | 3/3 code=0 |
| V3 T68 打印层：含 0件0包行订单落库 1 行 + 打印 code=0 + 文本无 0 行 | 通过 |

## 探针主结果（18 通过）

T68 点射（create/update/detail 三层 0件0包 过滤一致、纯 0 单 2001）/ 状态机全链 submitted→sorted→confirmed→completed / 两步收款 15+10 / 客户守恒 应收=已收+未结 / 结清 paid / 幂等同 token 双提交 pending=1 / 数量上限 123456→9999 / 列表 today+searchKey / 清理残留=0

## 收尾

- 探针残留 2 单（SDK 删漏）已人工清干净
- 基线恢复 orders=1 customers=282 products=167 payments=1 users=2，TEST 残留=0
- [x] 末轮全量 test-all 回归 15/15 步全绿 0 失败（审计 12/12、perm 22/0、pagewalk 13/13、deepwalk 24/24、role-sim 28/0、state-guard 16/0、csv 23/0、deep-chain 56/0、perf 10/0、e2e/idem 全过；QA 残留校验通过=生产安全态）
- 状态：已做（R21 增量复查完成，无新 bug；无代码改动，纯测试轮）
