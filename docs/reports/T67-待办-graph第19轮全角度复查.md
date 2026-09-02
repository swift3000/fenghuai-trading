# T67 — graph 第19轮（R19）全角度复查 + 历史问题防回归

- **日期**：2026-09-02
- **范围**：四路全角度（A 功能/B 数据/C 安全/D UI+token）+ 历史修复点逐条防回归（T66 数量上限 / T62 searchKey / T53 状态机 / T59 CSV 注入 / T11 幂等）
- **环境**：QA 钩子 10/10 开测→全程→10/10 关测（生产安全态）

## 结论

**R19 未发现新的真 P0/P1/P2 bug。** A/B 路探针的"失败"全部是 R18 已标注的假警报 + T66 口径变更导致的探针断言过时，逐条独立验证确认非回归。唯一产出：D 路 token 复查发现 1 处 T66b 漏网（custom-tab-bar 新建按钮渐变 #45D06F/#1E9E4B），已修（T66c，commit 8c4d9d8，合并 main 2174fe0）。

## 历史修复点防回归（独立验证，全绿）

| 点 | 验证方式 | 结果 |
|---|---|---|
| T66 数量上限（9999 截断） | 独立造 99999 件单 → piece_qty=9999 / totalAmount=99990 | ✅ 通过 |
| T66 资金链路（piece/case/unit 三模式计价） | 独立造三模式单，金额 20/25/15 全对 + 收款两步 + 超收 4002 拦截 | ✅ 10/10 通过，**T66 改数量未改坏计价** |
| T53 状态机终态守卫（cancelled/completed 不可二次出库/收款/编辑） | 独立造 cancelled 单，confirmSort/confirmOut 后 status 仍 cancelled 且未写 sortTime；completed 单 confirmOut 仍 completed | ✅ 6/6 写库拦截通过 |
| T59 CSV 公式注入转义 | 建 =cmd 客户名 → 导出已转义 raw==cmd | ✅ 通过 |
| T62 products searchKey | 回归调用 | ✅ 通过 |
| T11 幂等（同 clientToken 双提交/重复确认） | B 路 B3 pending=1 / received 不变 | ✅ 通过 |
| 金额守恒（应收=已收+折+未结） | B 路 B1 独立聚合对账 | ✅ 通过 |

## 探针假警报清单（R19 复跑 R18 探针，勿当 bug 重复报）

- A1 详情金额=25 失败：探针商品 pricing_mode='piece' 按设计只算件（2×10=20），探针写 25 是错期望；下游 collect 4002/confirmPayment 4004 是金额错配连锁。独立用正确金额 20 验证收款全通。
- A3 数量超上限"拒"失败：T66 把口径从"拒绝"改成"截断 9999"（对齐 smart T57-RA-3），探针断言 code!=0 过时。截断行为正确。
- A4 export excel fileID 失败：不传 reportTab 走空 csv 分支（R18 已知）。
- B4 cancelled confirmSort/confirmOut/collect 失败：探针断言 code!=0，但系统设计对终态返回 code=0+reused=true 且不写库（T11 P2-3 防重复流转）。独立验证 status 未被偷改，守卫正确。
- B5 吾宠湾粥商品未找到：T64 数据问题（R18 已知）。
- C2 orderer confirmSort/confirmOut 失败：权限矩阵本就给 orderer sort:task+warehouse:confirm=true（perm-matrix-shared.js:26-27），非越权。

## D 路 token 一致性

- 绿色系散落硬编码：T66b 收口后复查，pages/ 已清零；仅 custom-tab-bar/index.wxss:78 漏（#45D06F/#1E9E4B）→ T66c 修。
- 非 token hex 623 处：均为中性色（#FFF/#333/#999/#F0F0F0 等）+ 状态语义色（红橙蓝黄），token 表本就只有 5-8 个核心值，中性/状态色不入主色 token 属正常，不判违规。
- 死按钮：扫描器误报 113（正则漏 async 前缀），实际 grep 验证全定义，死按钮=0。

## 收尾

- [x] QA 钩子 10/10 → 10/10 关闭（生产安全态）
- [x] TEST 残留清理（11 订单 + 3 收款，基线恢复 orders=1/payments=1/cust=282/prod=167，TEST 残留=0）
- [x] T66c token 补漏合并 main（2174fe0）
- [x] pagewalk 13/13 + T66c 回归无破
