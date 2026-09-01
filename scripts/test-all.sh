#!/bin/sh
# 一键全量回归：逻辑单测 → 前端 UI/走查 → 云端多角色模拟 + E2E + 会员管理 → 恢复生产安全态 → QA 残留门禁
# 说明：QA 钩子开/关各需重新部署 7 个云函数（约 6-8 分钟），全程约 20-25 分钟。
# 上线前最后一次跑完必须停在 off（脚本自动执行），可用 `node tests/qa-toggle.js status` 复核。
set -e
cd "$(dirname "$0")/.."

# 微信开发者工具模拟器冷启动偶发竞态（页面实例未就绪），UI 类步骤失败自动重试一次
run_ui() {
  node "$1" || { echo "    ⚠ 首次失败，等待 5s 后重试..."; sleep 5; node "$1"; }
}

echo "==> [1/14] 数据对账审计（data-consistency）+ 权限逻辑单测（perm-logic）"
node tests/data-consistency-audit.js
node tests/perm-logic-test.js

echo "==> [2/14] 权限 UI 测试（wx-perm-ui，需微信开发者工具模拟器）"
run_ui tests/wx-perm-ui-test.js

echo "==> [3/14] 页面走查（wx-pagewalk）"
run_ui tests/wx-pagewalk-test.js

echo "==> [4/14] 多层级深度巡检（wx-deepwalk：L2 页内 tab + L3 弹窗）"
run_ui tests/wx-deepwalk-test.js

echo "==> [5/14] 开启 QA 身份钩子（部署 8 函数 QA_IMPERSONATE=1，约 3-4 分钟）"
node tests/qa-toggle.js on

echo "==> [6/14] 多角色云端 403 拦截 + 开关即时生效（wx-role-sim）"
run_ui tests/wx-role-sim-test.js

echo "==> [7/14] 状态机终态守卫回归（order-state-guard，T53：已取消不可分拣/出库 + 重复出库幂等不覆盖）"
node tests/order-state-guard-test.js

echo "==> [8/14] CSV 公式注入回归（csv-injection，T59-R10：=/+ 开头单元格导出必被转义 + 导出权限 403）"
node tests/csv-injection-test.js

echo "==> [9/14] 深链路交叉回归（deep-chain-cross，T59-R14：多客户多订单 报表/台账/收款方式 三口径交叉守恒）"
node tests/deep-chain-cross-test.js

echo "==> [10/14] 全业务流程 E2E（wx-e2e-flow）"
run_ui tests/wx-e2e-flow-test.js

echo "==> [11/14] 会员/权限管理（wx-member-mgmt）"
run_ui tests/wx-member-mgmt-test.js

echo "==> [12/14] 幂等专项验收（wx-empirical-idem：双击不重复登记/重复确认不重复入账）"
run_ui tests/wx-empirical-idem-test.js

echo "==> [13/14] 关闭 QA 身份钩子（恢复生产安全态，约 3-4 分钟）"
node tests/qa-toggle.js off

echo "==> [14/14] 收尾门禁：QA 残留校验（任一函数 QA_IMPERSONATE 非空或查询异常即失败）"
: > /tmp/qa-residue-check.log
node tests/qa-toggle.js status > /tmp/qa-residue-check.log 2>&1 || true
RESIDUE=$(grep -acE 'QA_IMPERSONATE=[^;[:space:]]' /tmp/qa-residue-check.log || true)
ERRQ=$(grep -ac '(err)' /tmp/qa-residue-check.log || true)
if [ "$RESIDUE" -gt 0 ] || [ "$ERRQ" -gt 0 ]; then
  echo '❌ 收尾门禁未通过：仍存在 QA_IMPERSONATE 残留（$RESIDUE）或查询异常（$ERRQ），当前【非】生产安全态！'
  grep -aE 'QA_IMPERSONATE|\(err\)' /tmp/qa-residue-check.log || true
  echo '   处理：重跑 node tests/qa-toggle.js off 后复核 node tests/qa-toggle.js status'
  exit 1
fi
echo '✅ QA 残留校验通过（全部函数 QA_IMPERSONATE 为空且无查询异常）'
echo '✅ 全量回归完成（当前为生产安全态）'
