# T57 任务卡：graph 循环测试 第1轮 发现处置

状态：进行中（2026-08-31，用户指令"测完再修复，循环5遍"，默认直接修）

## 来源
graph 循环 R1 四路（A功能/B数据/C安全/D UI-环境阻塞）报告：.local/graph-r1-B-dataflow-report.md + A/C 回传

## 清单
| 编号 | 级别 | 问题摘要 | 处置 | 状态 |
|---|---|---|---|---|
| RB-1 | P1 | orders.update 无状态守卫（可编辑重置状态/复活取消单） | 仅 submitted 可编辑，其余 3002 | 已做(96d1827) |
| RB-2 | P2 | runAutoConfirm 无终态守卫（cancelled 到点复活） | 补 cancelled/completed 拒绝 | 已做(96d1827) |
| RB-3 | P2 | collect 无 cancelled 守卫+聚合含已取消单 | collect 终态守卫+聚合过滤 cancelled | 已做(741219d) |
| RB-4 | P2 | 折价双口径（detail/print vs dashboard 对不上） | 对齐 T53 方案A（含待确认+标注），专项 10/10 | 已做(6e23a5b) |
| RC-1 | P2 | discount 字符串/负数校验缺失（拼接/虚增） | Number 强转+校验；**修复 const 重赋值崩溃** | 已做(486cfe2) |
| RC-2 | P2 | smart audioUrl 无校验（刷 ASR 配额） | 限 https+长度 | 已做(3e11494) |
| RA-1 | P2 | "0件"被改写 1 件 | 量词命中时 0 合法保留 | 已做(3e11494) |
| RA-3 | P2 | 数量无上限（999999件巨额单） | 整数化+上限 9999 | 已做(3e11494) |
| RA-4 | P2 | 前端小数静默吞+备注无上限 | 小数提示+备注 maxlength 100 | 已做(deaa338) |
| RB-5 | P3 | update-status 不查严格前向 | 扫描误报——T50-4 已有严格前向矩阵 | 误报,无需改 |
| RB-6 | P2 | system_config 3 legacy 脏文档 | 删前快照入库脱敏后删除 | 已做(32ec8d9) |
| RB-7 | P3 | 前端 float 求和 vs 服务端分位差 1 分 | 前端分位整数累加 | 已做(deaa338) |
| RB-8 | P3 | orders 7 action 无权限映射 | 扫描误报——permissionMap 已含映射 | 误报,无需改 |
| RC-3 | P3 | getAutoConfirmPolicy/regions.list 无身份校验 | 补登录/权限校验 | 已做(f7e6f7b) |
| RC-4 | P3 | orders/receivable 无顶层 try/catch | 补统一错误边界 | 已做(96d1827) |
| RC-5 | P3 | AGENTS.md 写 15 云函数实际 16 | 文档更正 15→16 | 已做(f7e6f7b) |
| RA-5 | P1(环境) | 开发者工具登录态过期 41001，模拟器通道断 | 需用户扫码登录 | 阻塞(等扫码) |## 防回归
order-state-guard-test.js 补 update/autoConfirm/cancelled-collect 用例；smart 单测补 0件/上限用例。

## 修复与验证结果（2026-08-31 R1 完成）

- 部署：orders/receivable/smart/regions 经 tcb CLI 部署成功（devtools CLI 登录态过期不影响 tcb）。QA 钩子最终关闭，全函数 QA_IMPERSONATE=空（生产安全态已复核）。
- 防回归：order-state-guard 云端 16/16 全绿（含 update/collect 状态守卫新用例）；smart-ai 8/8 全绿（含 0件/上限）。
- RB-4 口径专项 10/10：detail.payCalc 与 dashboard 未结清/pendingAmount 一致。
- RC-1 折价专项 4/4：负数/非数字拒 1001，字符串强转不拼接。
- **R1 自查抓出 1 个我引入的真 P1**：RC-1 把 discount 留在 const 解构又重赋值，带折价收款全 500（Assignment to constant variable，被顶层 catch 吞成固定文案）。已改 let 单列修复（486cfe2），对照矩阵全绿，已沉淀错误经验库。
- RB-5/RB-8 经代码核实为扫描误报，未改代码，改卡销项。
- 剩余：RA-5 模拟器链路（需用户扫码登录开发者工具）；RB-2 自动确认终态守卫建议 R2 用 QA 钩子造跨态订单专项验证。
