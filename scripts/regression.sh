#!/usr/bin/env bash
# fenghuai 一键回归入口（全局规则：每项目必须有 regression/smoke 两个入口）
# 依赖：微信开发者工具已登录且自动化已开启（QA_IMPERSONATE=1 模拟身份）
# 核心路径：登录→智能录入→录单→分拣→出库→收款→打印/转发
set -e
cd "$(dirname "$0")/.."
node scripts/sync-perm-matrix.js   # 权限矩阵一致性
npm run test:all
