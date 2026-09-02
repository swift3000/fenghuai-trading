# T66 — graph 第18轮（R18）发现处置

- **日期**：2026-09-02
- **分支**：fenghuai/req-T66-graph-r18（基于 main 1d2f702）
- **测试范围**：4 路并行全角度（A 功能/数据流、B 数据流、C 安全/权限、D UI 静态+设计 token），核心链路端到端全通

## 发现与处置

| 编号 | 级别 | 问题 | 处置 | 状态 |
|---|---|---|---|---|
| R18-A1 | P1 | 手动录单无数量上限：orders create 传 piece_qty:99999 被接受（¥999,990 巨额单可提交）。T57-RA-3 的 9999 上限只加在 smart 云函数，手动录单路径漏了 | orders create/update 的 items 归一化处加 normalizeQtyLocal（整数化+上限 9999+负数/NaN→0，对齐 smart 口径）；新增 tests/orders-qty-limit-test.js 12 断言；归一化值回写落库防 99999 原值残留 | 已修（待部署+回归销项） |
| R18-D1 | P2 | 设计 token 三套并存：token 表主色 #24AD52，app.wxss 变量 --theme-primary: #07C160，页面散落 #16A34A(17)/#24AD52(6)/#07C160(14)；756 处硬编码 hex；字阶 26/30/22rpx+px 混用 | **需老板拍板**：主色以 #07C160（现网微信绿）为准还是 #24AD52（token 表新值）？拍板后统一 app.wxss 变量+清理散落硬编码+字阶归一 | 待拍板 |
| R18-C? | P2 | 前端无"取消订单"入口（pages/ 零命中 cancel/取消订单）；后端支持（update-status→cancelled，仅 admin，必须带 reason） | 原型查证：12 处"取消"均为弹窗关闭按钮/状态展示（cancelled 态）/注释，**无取消订单操作入口** → 按钮三分法"有价值未实现"，标规划中登记，不在本轮补 | 已定：规划中（独立升级模块，不阻塞 MVP 范围） |

## 假警报排除记录（探针脚本参数错，非 bug，勿重复报）

- A4 excel 导出：不传 reportTab 走空 csv 分支；真实参数全返回 fileID ✅
- B4 cancelled 终态守卫：探针传错字段名 cancelReason（正确=reason/cancel_reason）+ 取消仅 admin；T53 守卫由 test-all 第 7 步 12 断言覆盖 ✅
- B5 products list 返回纯数组（非 {list:[]}）；计价 3×1.13=3.39 正确 ✅
- C 路 2 个"越权"：权限矩阵本就给 orderer sort:task+warehouse:confirm，非越权 ✅
- 混合件包订单 totalAmount 只算件=按设计（pricing_mode 三模式：piece→件、unit→包、case→双轨相加）✅

## 全绿项（R18 实测摘要）

核心链路全通（建客户→混合单→分拣→出库→两步收款→结清）；0 元订单拒 2001；exportSingleOrder；smart.match；products searchKey（T62 回归）；金额守恒（含折价独立聚合对账）；超收拦截 4002；幂等（同 clientToken 双提交/重复确认不重复入账）；垂直越权 3 角色×6 admin-only 全拒；角色边界（库管不可登记/分拣员不可确认/orderer 不可取消）；匿名/伪造 openid 全拒；CSV 注入转义；正则特殊字符搜索不 500；时间口径单调。C 路 31 通过、A 路 13 通过（1 真 bug）、B 路 10 通过、D 路死按钮 0。

## 销项

- [ ] 部署 orders + 修复点回归（99999→9999 / 9999 正常 / package_qty 同样）
- [ ] test-all 15 步全量（含 orders-qty-limit 单测纳入第 1 步）
- [ ] QA 钩子 10→0 复核
- [ ] 生产数据基线复核（customers 282 / products 167 / orders 1 / payments 1 / users 2）
