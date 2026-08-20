# T21 待办：test-all.sh 收尾 QA 残留门禁

状态：已做（2026-08-21）

## 背景
T20 全量回归第 9 步关钩子时遇腾讯云网络抖动（scf.tencentcloudapi.com timeout/socket hang up），导致 products、system 两函数残留 QA_IMPERSONATE=1，脚本却仍打印"可安全上线"——等于线上留了身份伪造后门且无告警。

## 改动
- test-all.sh 第 9 步关钩子后新增第 10 步【收尾门禁】：重跑 qa-toggle status 落盘 /tmp/qa-residue-check.log，解析：
  - RESIDUE = 含 `QA_IMPERSONATE=<非空值>` 的行数
  - ERROK  = 含 `(err)` 的行数（查询异常）
  - 任一 >0 → 红字告警 + 打印命中的函数 + `exit 1`（set -e 下整包回归判失败）
  - 全空且无异常 → 才允许打印"生产安全态"完成
- 步骤编号顺延 [1/9]-[9/9] → [1/10]-[10/10]

## 验证
- sh -n 语法 OK
- 三态构造日志实测：clean→PASS rc=0 / residue(products=1)→FAIL rc=1 / (err)→FAIL rc=1
- 本轮 T20 收尾已用补跑 off 将 8 函数全部恢复 QA_IMPERSONATE=空（复核确认生产安全态）

## 防回归
- 该门禁挂在 scripts/test-all.sh，每次 npm run test:all 自动执行，网络抖动再残留即整包红。
