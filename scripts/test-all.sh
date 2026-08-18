#!/bin/sh
# 一键全量回归：逻辑单测 → 前端 UI/走查 → 云端多角色模拟 + E2E + 会员管理 → 恢复生产安全态
# 说明：QA 钩子开/关各需重新部署 8 个云函数（约 6-8 分钟），全程约 15-20 分钟。
# 上线前最后一次跑完必须停在 off（脚本自动执行），可用 `node tests/qa-toggle.js status` 复核。
set -e
cd "$(dirname "$0")/.."

# 微信开发者工具模拟器冷启动偶发竞态（页面实例未就绪），UI 类步骤失败自动重试一次
run_ui() {
  node "$1" || { echo "    ⚠ 首次失败，等待 5s 后重试..."; sleep 5; node "$1"; }
}

echo "==> [1/8] 权限逻辑单测（perm-logic）"
node tests/perm-logic-test.js

echo "==> [2/8] 权限 UI 测试（wx-perm-ui，需微信开发者工具模拟器）"
run_ui tests/wx-perm-ui-test.js

echo "==> [3/8] 页面走查（wx-pagewalk）"
run_ui tests/wx-pagewalk-test.js

echo "==> [4/8] 开启 QA 身份钩子（部署 8 函数 QA_IMPERSONATE=1，约 3-4 分钟）"
node tests/qa-toggle.js on

echo "==> [5/8] 多角色云端 403 拦截 + 开关即时生效（wx-role-sim）"
node tests/wx-role-sim-test.js

echo "==> [6/8] 全业务流程 E2E（wx-e2e-flow）"
node tests/wx-e2e-flow-test.js

echo "==> [7/8] 会员/权限管理（wx-member-mgmt）"
node tests/wx-member-mgmt-test.js

echo "==> [8/8] 关闭 QA 身份钩子（恢复生产安全态，约 3-4 分钟）"
node tests/qa-toggle.js off

echo "✅ 全量回归完成（当前为生产安全态）"
