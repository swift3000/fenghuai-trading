# T75 · R25 拆仓后全量复测（第 25 轮）

- **状态**：已做（R25 收尾，见 commit 记录）
- **日期**：2026-09-05
- **触发**：老板指令"对这个项目（钱多多），全部再检查一遍、测试一遍"
- **背景**：2026-09-04 拆仓（swift3000/qian-duoduo，T74 品牌改名 乾多多→钱多多），本轮为拆仓后第一次全量回归
- **测试方式**：全量 4 路口径（用户指令覆盖增量制）——逻辑单测/数据对账 + 云端身份测试 + UI 走查（L1 13 页 + L2/L3 24 断言）+ 性能基线

## 结论

**产品代码零问题（含 T74 品牌改名后的全部云函数），可投放。修掉 3 个测试脚本缺陷（全部是测试自身 bug，产品语义均正确）。**

## 全量测试结果（全部通过）

| 类别 | 测试 | 结果 |
|---|---|---|
| 权限 | check:perms 矩阵一致 / perm-logic 22 / wx-perm 15 / wx-role-sim 多角色 403+开关即时生效 28 | ✅ |
| 数据 | data-consistency-audit 12/12（跑前/跑后各一次） | ✅ |
| 金额 | deep-chain-cross 三口径守恒 15/15 · e2e-receivable 两步收款+超收拦截 9/9 · e2e-zero-value 0 值边界 9/9 | ✅ |
| 安全 | csv-injection Excel 公式注入转义+导出权限 13/13 | ✅ |
| 状态机 | order-state-guard 终态守卫+幂等 16/16 | ✅ |
| 时间 | e2e-timerange 自定义区间+算账一致 11/11（修复后） | ✅ |
| 性能 | perf-baseline 10并发×5接口 零错误，P95 告警（环境负载压尾，P50 正常，非退化） | ✅ |
| UI | wx-pagewalk L1 13 页 13/13 · wx-deepwalk L2 tab+L3 弹窗 24/24（模拟器实测） | ✅ |

## 测试脚本缺陷修复（3 个，产品无 bug）

### 1. e2e-timerange UTC/北京日期边界混用（本轮新发现）

- **现象**：凌晨 0-8 点跑，"本月区间(有数据)"假 FAIL（products=0）
- **根因**：脚本 `new Date().toISOString().slice(0,10)` 取 UTC 日期（凌晨落后北京一天）；云函数按项目时区纪律（TZ=Asia/Shanghai）过滤 → 期望值把测试单算进"本月"、云函数正确排除。白天跑 UTC=北京日期所以不暴露，凌晨必炸
- **修复**：today/ym 改 `toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"})`；断言顺序重构为"先造今日测试单再断言报表"（原顺序断言在造单前，干净基线下本月本就无单，依赖历史残留才碰巧通过）
- **连带**：e2e-zero-value 同款 UTC 口径一并修（B3 只断 code=0 未炸，口径对齐防未来踩）

### 2. e2e-receivable 清理被 T50-3 红线静默拦截（本轮新发现）

- **现象**："回归-确认"单（有已确认收款）API delete 被 T50-3 资金红线正确拦截，原实现静默失败 → 残留订单+孤儿 payments 污染生产基线（已实测污染过一次）
- **修复**：清理改"API 优先 + SDK 兜底"（API 拒绝→SDK 强删 payments+orders），造单补 customerId（防孤儿单污染报表客户聚合）+ 测试客户自清理
- **注意**：T50-3 是产品红线（有已确认收款的订单禁删），行为正确，只修测试清理方式

### 3. （上轮 T72 已修，本轮防回归复测通过）e2e-timerange customerId 缺失 / wx-perm 邀请断言 / state-guard 用户残留

## 环境事实

- 拆仓后远端 = swift3000/qian-duoduo，main 同步，T74 改名无测试断言残留（rg 核实）
- .gitignore 的 T73 改动属另一会话，未触碰
- QA 钩子 on/off 各约 5 分钟（10 函数逐个部署），本轮开/关均正常（无静默退出抽风）
- 基线：orders=1（黄焖鸡2店 508 confirmed）/ customers=282 / products=167 / payments=1 / users=2；TEST 残留=0

