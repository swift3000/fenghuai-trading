# T59 任务卡：graph 循环测试 第7轮 发现处置

状态：进行中（2026-08-31，用户要求 graph 测试 10 轮，R7-R16）
分支：fenghuai/bugfix-t59-graph-r7

## 来源
graph 循环 R7 四路并行（A 功能流 / B 数据流 / C 安全流 / D UI 流），只读+QA 钩子，零生产写入。
生产数据基线：customers 282 / products 167 / orders 1（508 元 paid）/ payments 1 / users 3。

## 结论速览
P0:0 / P1:0 / P2:4 / P3:3。三个 P2 已修（独立 commit）；R7B-2 财务展示口径动业务语义，按 graph 政策报老板拍板，不擅改。

## 清单
- R7B-3 [P2] orders create/update 在服务端重算前用前端 totalAmount 做 0 元拦截：前端口径漂移会把合法订单误拒 2001。处置：移除对前端 totalAmount 的拦截，0 元红线单点收拢在服务端重算处。状态：已做(e08b87b)。
- R7C-1 [P2] import-data/simple-import.js OPENID 全量未脱敏进日志（PII）。处置：对齐 auth 口径脱敏；非部署入口，线上不可触达，低危。状态：已做(e08b87b)。
- R7D-70 [P2] customers/products 页导入原型数据弹窗无入口按钮，wx:if 恒 false，方法/284 条数组成死代码。处置：按钮三分法删除；products 保留 DEFAULT_PRODUCTS（降级用）。状态：已做(e08b87b)。
- R7B-2 [P2] 财务展示口径：receivable 列表状态用派生 balance（方案A 已收含待确认）先判已结清，而 payment_status 只认 confirmed。边界 total=100/confirmed=60/pending=40 显示已结清但 payment_status=pending。无多计、守恒成立，纯展示分叉。处置：动业务语义（T53 方案A 已由用户 R1 拍板），按 graph 政策报老板。方案A=改按 payment_status 判结清；方案B=保持方案A+UI 标注待确认。状态：待老板决策。
- R7B-1 [P3] 订单号前缀硬编码 乾多多-日期，生产唯一订单是 丰淮商贸-20260826-0001，双前缀并存。状态：待做，需产品确认订单号前缀。
- R7B-4 [P3] 商品库 45 个单价超 2 位小数，toFixed(2) 展示差 1 分；1 个双 0 价商品调货。状态：待做，金额计算无误差。
- R7C-备注 [P3] collect amount 未做与 discount 同款的分位归一，口径不对称。状态：待做，方向安全。

## 全绿项（R7 四路交叉验证）
- 金额三方一致（B）：1120 行+140 多行订单逐行 0 失配、总额±0 分。
- 0 元/0 件红线矩阵 6/6（B）；收款边界（B）：超收 4002、恰=欠款 paid、pending 占额无 double-count。
- 双写字段普查（B）：orders/payments 0 失配，products 167 无负价。
- 状态派生/守恒（B）：0 脏单，508=Σ行=Σconfirmed，无孤儿/0 元/0件0包。
- SAST/密钥/注入面（C）：业务代码 0 真实漏洞；无密钥入库；db.RegExp 8/8 转义、CSV 公式注入全覆盖。
- 权限矩阵（C）：20 键对齐，16 函数无静默免检。
- L1 13/13 + L2/L3 24/24 + 按钮 sweep 61 项 0 FAIL（D），无死按钮；边界四态/原型对齐零不一致（D）。
- 并发（B）：10x5 零错误，P95 最高 1861ms。

## 待老板决策
- R7B-2：方案A（按 payment_status 判结清）vs 方案B（保持方案A+UI 标注待确认）。

## 验证结论（R7）
- 四路 P0/P1=0；3 个 P2 独立 commit + node --check + push。
- 生产安全态：QA 钩子本轮开启跑 A 功能流，收工前必 qa-toggle off 复核 16 函数全空。
- 数据：零生产写入，TEST 残留=0。

## R7 全量回归（test-all 12 步，全绿）
- [1] 数据对账 12/0 + 权限逻辑 19/0；[2] 权限UI 12/0；[3] 走查L1 13/0（products 167/customers 282 正常，前端死代码删除未破坏）
- [4] 深度巡检 24/0；[6] 多角色403 28/0；[7] 状态机守卫 16/0
- [8] 全业务E2E 23/0（含服务端 orders 修复后链路）；[9] 会员/权限 56/0；[10] 幂等 10/0
- [11/12] QA 钩子关 + 残留校验通过（生产安全态）

## 数据污染清理（回归前置）
- 回归 step1 审计[7] 因 users 集合 2 条空 openid 孤儿（无姓名/pending，历史QA残留，无法登录）失败。按数据污染立即清理纪律，精确按 ID 删 2 条空 openid 孤儿（保留真实 admin + QA_orderer 预置），恢复基线 2 用户，审计转绿。
