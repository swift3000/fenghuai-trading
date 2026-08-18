#!/usr/bin/env bash
# fenghuai 冒烟入口（核心最小路径，发版后/部署云函数后必跑）
set -e
cd "$(dirname "$0")/.."
echo "== 权限矩阵 =="; node scripts/sync-perm-matrix.js
echo "== 页面走查（登录/录单/列表可达）=="; npm run test:wx-pages
echo "✅ 冒烟通过"
