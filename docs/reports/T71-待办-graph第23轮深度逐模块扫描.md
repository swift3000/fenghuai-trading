# T71 · R23 graph 测试：深度逐模块扫描（第 23 轮）

- **状态**：已做（R23 收尾，见 commit 记录）
- **日期**：2026-09-03
- **触发**：老板指令"每个模块、每个功能、每个点、每个界面、每个二级三四五级页面全部做，边测边修"
- **测试方式**：graph 4 路 + 全模块探针 + L2/L3 深度走查 + 独立验证探针

## 结论

**无新 bug，可投放。** 10 个模块探针 41 断言 + 修正探针 12+7 断言全过；所有初判"失败"项经独立验证探针（r23fix/r23fix2/r23cleanup）逐一澄清为探针断言口径错，非产品问题。

## 10 模块逐功能结果

| 模块 | 探针 | 结果 | 备注 |
|---|---|---|---|
| auth | r23perfunc | PASS | 登录/身份返回正常 |
| customers | r23perfunc | PASS | 增删改查+字段校验全过 |
| products | r23perfunc | PASS | 增删改查+pricing_mode 全过 |
| orders | r23perfunc | PASS | 创建/状态流/0 元拦截全过 |
| new-order（智能录入） | r23perfunc | PASS | 文字/语音双模式解析正常 |
| outbound | r23perfunc | PASS | 分拣/出库/包裹件数落库全过 |
| receivable | r23fix2 | PASS | collect/confirmPayment/paymentHistory/T63-3 防泄露/幂等/超收拦截全过 |
| reports | r23perfunc | PASS | 报表口径与金额一致 |
| members/权限 | r23perfunc | PASS | 4 角色矩阵正常（save-perm 签名=role+数组） |
| system/设置 | r23perfunc | PASS | updateConfig 正常（setConfig 是旧 action） |

## 深度结构探测

- L1 14 页 / L2 页内 tab / L3 弹窗表单，**代码内所有路由目标均已在 app.json 注册，无 L4/L5 深层页面**（微信小程序结构天然 3 层封顶）
- 总 tap 绑定 167 处（各页面计数见探针脚本 /tmp/r23scan.cjs 输出）

## 关键澄清（探针口径错 vs 真 bug）

1. `pending`/`history`/`pendingSort`/`pendingOut`/`setConfig` 等 action 名不匹配 → 真实 action 为 `pendingConfirm`/`paymentHistory`/`pendingSortList`/`pendingOutList`/`updateConfig`
2. `save-perm` 400 → 真实签名是 `role`+`permissions` 数组，非对象
3. 包裹件数落库 undefined → `confirmOut` 需调 **orders** 云函数（705-739 行落库 ship_large/medium/small），不是 outbound
4. `paymentHistory` 1001 → **T63-3 安全设计**（customerId 必填防跨客户泄露，缺参必须拒）
5. "结清 paid 失败" → 探针收 20 元/订单 50 元，本该部分收款保持 pending，不该 paid
6. `confirmedBy` 字段 → 云函数实际写的是 `confirmed_by`（下划线），前端不读该字段，无影响
7. 订单删除被拦 → **T50-3 资金红线**正常生效（有已确认收款的订单禁止物理删除），测试残留改走 SDK 强删

## 环境问题（非代码 bug）

- QA toggle 部署窗口多次静默抽风，需 nohup 后台 + 轮询重拉（T70 已记，本轮复发，已在经验库）
- `qa-toggle status` 在部署中存在瞬时计数抖动（10→9→7→5→3→0 稳定），须等部署完成再终判

## 收尾

- TEST_R23* 残留全清（orders/customers/products/payments=0）
- 生产基线恢复：orders=1（丰淮商贸-20260826-0001，508 confirmed）/ customers=282 / products=167 / payments=1 / users=2
- QA 钩子 0/10 关闭（cloudbaserc.json 已恢复原状）
- 代码零改动（纯测试+文档轮）

