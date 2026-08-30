# T58 任务卡：graph 循环测试 第6轮 发现处置

状态：进行中（2026-08-31，用户"修复后继续graph测试"）

## 来源
graph 循环 R6 云端专项（管理类函数越权/auth 边界/性能基线）；模拟器 UI 链路仍被 RA-5（devtools 未登录）阻塞，本轮纯云端。

## 清单
| 编号 | 级别 | 问题 | 处置 | 状态 |
|---|---|---|---|---|
| R6-1 | P2 | clear-all-data 集合清单错误：receivable/outbound/members 是云函数名非集合名（remove 静默失败=假清库），且漏真实集合 payments（清库残留孤儿收款）+auto_confirm_log | 修正为 [customers,products,orders,payments,auto_confirm_log]，不动 users/system_config | 已做(9ce6c45+deploy) |
| R6-2 | P2 | cloudbaserc.json 漏 clear-all-data/init-db 两函数，auto-deploy 脚本以 cloudbaserc 为准→这俩永不被自动部署（代码更新漏上线） | 补登记两函数（参照管理函数不带 QA 钩子），functions 14→16 与 AGENTS 对齐 | 已做(c673ac4+deploy) |
| R6-3 | P3 | sync-data/import-data 无权限时返回 success:false+message 但无 code 字段（其余函数有 code），错误响应结构不统一 | 登记，建议后续统一补 code（非阻塞，前端仅展示 message 行为正常） | 待做(P3建卡) |

## 验证结论（R6 安全面，无洞）
- 管理函数越权：匿名直连 13 个管理 action 全部被拒（clear-all-data/check-customer-fields/init-db→401，system→2001[文档§1.4 定义无权限码]，sync-data/import-data→无权限 message）
- auth：匿名 login 不放行（无 OPENID→500）；白名单防"谁先扫谁是管理员"、邀请码脱敏、幂等激活设计完整
- 性能：10 并发匿名 401 avg 234ms / 10 并发 DB 直读 avg 19ms，远低于 2s 基线，零错误
- 生产安全态复核：10 函数 QA_IMPERSONATE 全空；测试数据零残留

## 未做（阻塞/豁免）
- R6 未实际触发 clear-all-data 验证（会以 admin 清空线上真实数据，风险高）——修正靠代码+node --check+部署，不实际清库
- 模拟器 UI 走查（RA-5 devtools 未登录，需用户扫码）
