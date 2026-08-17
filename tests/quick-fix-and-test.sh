#!/bin/bash
# 快速修复和测试脚本

echo "=========================================="
echo "  🔧 快速修复和测试"
echo "=========================================="
echo ""

PROJECT_ROOT="/Users/god/Desktop/项目/github/fenghuai-trading"

# 1. 检查云函数是否存在
echo "📋 1. 检查云函数文件"
echo "-------------------"
CF_LIST="auth users customers products orders receivable outbound report regions system smart init-db check-customer-fields clear-all-data import-data"
for cf in $CF_LIST; do
  if [ -d "$PROJECT_ROOT/cloudfunctions/$cf" ]; then
    echo "✅ $cf"
  else
    echo "❌ $cf - 不存在"
  fi
done
echo ""

# 2. 检查关键页面文件
echo "📋 2. 检查关键页面文件"
echo "-------------------"
PAGES="login index new-order orders order-detail products customers receivable outbound report profile members system"
for page in $PAGES; do
  if [ -f "$PROJECT_ROOT/pages/$page/$page.js" ]; then
    echo "✅ pages/$page"
  else
    echo "❌ pages/$page - 不存在"
  fi
done
echo ""

# 3. 检查 JS 语法错误
echo "📋 3. 检查 JS 语法错误"
echo "-------------------"
echo "检查 products.js..."
node -c "$PROJECT_ROOT/pages/products/products.js" && echo "✅ products.js 语法正确" || echo "❌ products.js 有语法错误"

echo "检查 order-detail.js..."
node -c "$PROJECT_ROOT/pages/order-detail/order-detail.js" && echo "✅ order-detail.js 语法正确" || echo "❌ order-detail.js 有语法错误"

echo "检查 new-order.js..."
node -c "$PROJECT_ROOT/pages/new-order/new-order.js" && echo "✅ new-order.js 语法正确" || echo "❌ new-order.js 有语法错误"

echo "检查 login.js..."
node -c "$PROJECT_ROOT/pages/login/login.js" && echo "✅ login.js 语法正确" || echo "❌ login.js 有语法错误"
echo ""

# 4. 检查云函数语法
echo "📋 4. 检查云函数语法"
echo "-------------------"
for cf in $CF_LIST; do
  if [ -f "$PROJECT_ROOT/cloudfunctions/$cf/index.js" ]; then
    node -c "$PROJECT_ROOT/cloudfunctions/$cf/index.js" 2>&1 && echo "✅ $cf/index.js 语法正确" || echo "❌ $cf/index.js 有语法错误"
  fi
done
echo ""

echo "=========================================="
echo "  ✅ 检查完成"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 在微信开发者工具中点击【编译】"
echo "2. 右键 cloudfunctions 文件夹 → 【上传并部署：云端安装依赖】"
echo "3. 运行 init-db 云函数初始化数据库"
echo "4. 测试登录和功能"
echo ""
