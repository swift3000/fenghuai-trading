#!/bin/bash
# W0 自动化部署脚本
# 乾多多采购下单小程序

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 开始 W0 自动化部署"
echo "=========================================="
echo ""

# 1. 检查登录状态
echo "📋 步骤 1: 检查登录状态..."
if ! tcb islogin > /dev/null 2>&1; then
    echo "❌ 未登录，请先执行：tcb login"
    echo "然后用微信扫码授权"
    exit 1
fi
echo "✅ 已登录"
echo ""

# 2. 查看环境信息
echo "📋 步骤 2: 查看环境信息..."
tcb env info
echo ""

# 3. 部署所有云函数
echo "📋 步骤 3: 部署 10 个云函数..."
echo "⏳ 这可能需要 10-15 分钟..."
tcb fn deploy --all --force
echo "✅ 云函数部署完成"
echo ""

# 4. 查看云函数列表
echo "📋 步骤 4: 查看已部署的云函数..."
tcb fn list
echo ""

echo "=========================================="
echo "✅ 云函数部署完成！"
echo "=========================================="
echo ""
echo "下一步：初始化数据库"
echo "请执行：./scripts/init-db-auto.js"
