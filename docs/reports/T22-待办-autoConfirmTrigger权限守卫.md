# T22 · autoConfirmTrigger 权限守卫

状态：已做（2026-08-21，commit 见 git log）

## 背景
出库页「⏰ 模拟16:00通过」按钮调用 orders.autoConfirmTrigger。该 action 原本不在 permissionMap，
任何登录用户（含无出库权限角色）都能触发定时自动确认。用户拍板：按钮保留，云函数加权限守卫。

## 口径
- 带身份调用（小程序真实用户 / QA 模拟）：须有 sort:task 或 warehouse:confirm 任一（与出库页可达口径、outboundList 双检一致），否则 403「无权限执行自动确认」。
- 无身份调用（服务端 cron 定时触发器 autoConfirm，每5分钟）：内部系统调用放行，原有三道限制不变（配置 enabled / 时间门 / 当天幂等）。
- 注意：cron 触发走服务端调用无 WX 身份，守卫必须放行该路径，否则定时自动确认功能整体失效（P0）。

## 验证
- 无身份调用 → code:0 skipped:disabled（cron 路径放行 ✓）
- 管理员 QA 模拟 → code:0 skipped:disabled（放行 ✓）
- orderer 剥离 sort:task/warehouse:confirm 后 QA 模拟 → 403（守卫生效 ✓）
- reset-perm 恢复 → 重新放行 ✓
- 回归 tests/wx-role-sim-test.js 28/28 全绿（含 T22 三条新用例）
- 关钩子后 10 函数 QA_IMPERSONATE 全部为空（生产安全态 ✓）
