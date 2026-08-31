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
[DONE-SEE-BOTTOM] R7B-2 [P2] 财务展示口径：receivable 列表状态用派生 balance（方案A 已收含待确认）先判已结清，而 payment_status 只认 confirmed。边界 total=100/confirmed=60/pending=40 显示已结清但 payment_status=pending。无多计、守恒成立，纯展示分叉。处置：动业务语义（T53 方案A 已由用户 R1 拍板），按 graph 政策报老板。方案A=改按 payment_status 判结清；方案B=保持方案A+UI 标注待确认。状态：已做(2b707d7+deploy+边界6/6+回归12/12)。
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

## R7B-2 方案A 落地验证（2026-08-31 老板拍板方案A）
- 改动：receivable dashboard tab 过滤+settledCount 按 paidOrders/orderCount；前端订单行/客户级状态按 payment_status；PAYMENT_STATUS_TEXT.pending=待确认。金额口径不变（T53 方案A 已收含待确认，守恒成立）。
- 边界实测（真实库造夹具 total=100/confirmed=60/pending=40/payment_status=pending/派生欠款=0，进程内加载云函数+QA 钩子 admin 身份）：6/6 全过——unpaid tab 含该客户、settled tab 不含、订单行/客户级文案=待确认、settledCount 口径一致。夹具已清零（customers/orders/payments 残留 0/0/0）。
- 全量回归（test-all 12 步）：全绿。首次运行在 step3 遇瞬时网络抖动 ENOTFOUND 中止（非代码问题），重跑 12/12 通过：对账 12/0、权限 19/0、权限UI 12/0、走查 13/0、深度 24/0、403 28/0、状态机 16/0、E2E 23/0、会员 56/0、幂等 10/0、QA 残留校验通过（生产安全态）。

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


## R8 settings 写链路 + ASR/NLP 降级（2026-08-31）
- 进程内加载 system/smart 云函数实测 17/18：密钥写链路门禁（getAiConfig/getConfig/updateAiConfig/updateConfig 全 admin 独占，非 admin 2001 拒）、写链路幂等、降级路径（checkAsrReady/checkNlpReady 仅返 ready 布尔不泄密、规则引擎命中带 price+material_code、未命中降级不崩）。生产现状 ASR/NLP 均未配置（ready 均 false）走纯规则引擎=正常。
- 1 FAIL 定性=测试桩 SDK 口径错配（node-sdk 冒充 wx-server-sdk 把 {data:} 写成嵌套 data 键，短暂污染 system_config，已还原逐字节校验 MATCH），非生产代码 bug；经验库已沉淀。

## R9 并发深钻 + 幂等回归（2026-08-31）
- 钱敏感真云并发（confirm 防双记/clientToken 幂等）已由 wx-empirical-idem 10/0 + wx-role-sim 28/0 覆盖（test-all 全绿）。
- **新发现并修复 P2 资金红线敞口**：collect 的 pending 占额校验是 get→check→add 非原子（TOCTOU 窗口），并发可挂出超额 pending；原 confirmPayment 无上限拦截，超额 pending 被确认→已收>应收超收错账。已加超收拦截（翻转前 已确认实收+折价+本笔实收+折价 > 订单总额 → 4002 拒，payment 保持 pending 可回退），纯防御不改正常确认行为。进程内单测 6/6（115>100 拒 / 含折价 105>100 拒 / 恰好=100 放行结清 / 被拒不翻转 / 订单不污染）。commit ab0ef02 + 部署 receivable。
- **全量回归（单进程）12/12 全绿**：对账 12/0、权限 19/0、权限UI 12/0（首跑 10/2 模拟器冷启动竞态内置重试恢复）、走查 13/0、深度 24/0、403 28/0、状态机 16/0、E2E 23/0、会员 56/0、幂等 10/0、QA 残留校验通过（生产安全态）。注：首次回归 403 27/1 系误启多个 test-all 并发抢模拟器/QA钩子互相污染，非代码问题；单进程重跑 28/0。
- 测试纪律教训（经验库已沉淀）：test-all.sh 是长生命周期进程，跨 exec 反复启动会并发跑多实例互相污染；启动前必须先 ps 枚举 PID 确认 0 个在跑，且只启一次、之后只轮询日志不再启动。

## R1-R9 累计
- P0:0 / P1:0；已修 5 个 P2（R7B-3/R7C-1/R7D-70/R7B-2 方案A/R9 超收拦截）；登记 P3：订单号前缀、商品单价小数位、amount 归一对称、错误码统一。
- 生产安全态：QA 钩子 10 函数全空；数据基线 customers 282 / orders 1 / payments 1 / users 1（测试admin）；TEST 残留 0。
