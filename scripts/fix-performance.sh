#!/bin/bash
# 性能修复脚本

echo "🔧 开始优化小程序性能..."

# 1. 检查图标文件是否存在
echo "📋 检查图标文件..."
for icon in home home-active order order-active money money-active outbound outbound-active profile profile-active; do
  if [ -f "assets/icons/${icon}.png" ]; then
    echo "  ✅ ${icon}.png 存在"
  else
    echo "  ❌ ${icon}.png 缺失"
  fi
done

# 2. 检查云函数
echo "📋 检查云函数..."
for cf in orders customers products auth receivable report; do
  if [ -f "cloudfunctions/${cf}/index.js" ]; then
    echo "  ✅ ${cf} 云函数存在"
  else
    echo "  ❌ ${cf} 云函数缺失"
  fi
done

echo "✅ 检查完成"
