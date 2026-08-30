# T57 任务卡：graph 循环测试 第1轮 发现处置

状态：进行中（2026-08-31，用户指令"测完再修复，循环5遍"，默认直接修）

## 来源
graph 循环 R1 四路（A功能/B数据/C安全/D UI-环境阻塞）报告：.local/graph-r1-B-dataflow-report.md + A/C 回传

## 清单
| 编号 | 级别 | 问题 | 处置 | 状态 |
|---|---|---|---|---|
| RB-1 | P1 | orders.update 无状态守卫（已出库/已收款/已取消可编辑，状态硬重置，cancelled 复活） | update 加状态守卫：仅 submitted 可编辑（对齐 T53 状态机收口方向），3002 拒绝 | 待做 |
| RB-2 | P2 | runAutoConfirm 无终态守卫（cancelled 到点复活） | 同 T53 confirmSort/confirmOut 口径补 cancelled/completed 拒绝 | 待做 |
| RB-3 | P2 | collect 无 cancelled 守卫 + dashboard 欠款聚合含已取消单 | collect 加状态守卫；dashboard/customerDetail 聚合按 status 过滤 cancelled | 待做 |
| RB-4 | P2 | 折价双口径（未确认折价期间 detail/print 欠款 vs dashboard 对不上） | 对齐 T53 B-1 方案 A 口径统一（含待确认+标注） | 待做 |
| RC-1 | P2 | discount 字符串/负数校验缺失（'5'→'52' 字符串拼接、负数虚增欠款） | collect 入口 discount 同 amount 口径：Number() 强转+isNaN/<=0 拒绝 1001 | 待做 |
| RC-2 | P2 | smart audioUrl 无校验（刷 ASR 配额） | 限 https 协议+长度上限 | 待做 |
| RA-1 | P2 | "0件"被改写为 1 件（cnNumToInt\|\|1） | 量词命中时 0 为合法值不兜底；仅无量词时兜底 1 | 待做 |
| RA-3 | P2 | 数量无上限/小数（999999件→¥44,999,955） | smart 层 qty 整数化+上限 9999 拒绝/截断 | 待做 |
| RA-4 | P2 | 前端 onQtyInput parseInt 静默、备注无上限 | 前端小数提示+备注 maxlength | 待做 |
| RB-5 | P3 | update-status 白名单不查严格前向（confirmed→submitted 降级） | 加严格前向矩阵 | 待做 |
| RB-6 | P2 | system_config 3 个 legacy 脏文档（1 个内嵌 autoConfirm:true 死数据） | 备份内容入报告后删除 | 待做 |
| RB-7 | P3 | 前端展示 float 求和 vs 服务端分位差 1 分 | 前端展示改分位计算 | 待做 |
| RB-8 | P3 | orders 7 action 无权限映射静默跳过 | 补 permissionMap 映射 | 待做 |
| RC-3 | P3 | getAutoConfirmPolicy/regions.list 无身份校验 | 补基础登录校验 | 待做 |
| RC-4 | P3 | orders/receivable main 无顶层 try/catch | 补统一错误边界 | 待做 |
| RC-5 | P3 | AGENTS.md 写 15 云函数，实际 16（漏 sync-data） | 文档更正 | 待做 |
| RA-5 | P1(环境) | 开发者工具登录态过期 errcode=41001，模拟器通道断 | **需用户扫码登录**，非代码 | 阻塞(等用户) |

## 防回归
order-state-guard-test.js 补 update/autoConfirm/cancelled-collect 用例；smart 单测补 0件/上限用例。
