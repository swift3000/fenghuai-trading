# T55 任务卡：graph二轮复扫·安全流发现（2026-08-30）

状态：已做（2026-08-30，SC-3~SC-8 全修，分支 fenghuai/bugfix-t55-scan-findings）
来源：docs/reports/graph二轮-安全流C-报告-20260830.md

## 修复记录
- SC-1（日志拼接×8）：已在 8a79fc2（T53 低危销项）修完，本轮复扫 semgrep unsafe-formatstring 清零确认
- SC-2（init 脚本 execSync×2）：已在 8a79fc2 加白名单标注，本轮 SAST 确认属预期（本地一次性脚本无输入通路）
- SC-3 P0 clear-all-data 无鉴权：6da294c 入口加 admin 门禁（role+status），部署后匿名态实测 401「未登录」生效
- SC-4 init-db/check-customer-fields 无鉴权：6da294c 同补门禁；b2b3248 额外修 init-db 预存死函数 bug（scloud.init 未定义变量→ReferenceError，门禁原本不可达）
- SC-5 四处 checkAdmin 不校验 status：6da294c 补 status 禁用拦截，与业务侧口径统一
- SC-6 orders 行级负单价：6da294c create/update 补 1001 拦截
- SC-7 collect 非数字 amount：6da294c 补 1001 显式拒绝
- SC-8 openapi 漂移：d8fa5b0 重生成 68 接口，双向 diff phantom=0/missing=0
- 验证：9 云函数已部署；匿名态动态验证 3 门禁 401 生效+数据未动（282/167/1）；main 外分支全量回归 12 步全绿（对账12/12+权限UI12/12+页走查13/13+deepwalk24/24+403矩阵28/28+状态机12/12+E2E23/0+会员56/0+幂等10/0+QA残留门禁✅），生产安全态
- 待办：由用户拍板 merge --no-ff 回 main；合并后 main 再跑一次回归

| 编号 | 级别 | 待办 | 状态 | 建议 |
|---|---|---|---|---|
| SC-3 | P0 | clear-all-data 生产无鉴权可 wipe 6 集合 | 已做(6da294c) | 入口加 admin 门禁（role+status），部署后匿名态 401 实测生效 |
| SC-4 | P2 | init-db / check-customer-fields 生产无鉴权 | 已做(6da294c+b2b3248) | 同补门禁；另修 init-db 预存 scloud 死函数 bug |
| SC-5 | P2 | admin 门禁不校验 status | 已做(6da294c) | 4 处 checkAdmin 补 status 禁用拦截 |
| SC-6 | P2 | orders.create 行级负单价未拦截 | 已做(6da294c) | create/update 补 1001 拦截 |
| SC-7 | P3 | collect 非数字 amount 按 0 元登记 | 已做(6da294c) | 非数字/<=0 补 1001 显式拒绝 |
| SC-8 | P2 | openapi.yaml phantom action 与代码漂移 | 已做(d8fa5b0) | 重生成 68 接口，双向 diff phantom=0/missing=0 |

关联回归：SC-3/4 修复后须重跑 403 矩阵 + check:perms + test:all；SC-6 修复须加负价单用例。
