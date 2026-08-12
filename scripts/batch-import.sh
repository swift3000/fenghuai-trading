#!/bin/bash

# 数据导入脚本
# 导入所有商品和客户数据到微信云开发数据库

ENV_ID="cloud1-d6g75loi673b1e039"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "📦 开始导入数据到微信云开发"
echo "环境：$ENV_ID"
echo "=========================================="

# 导入商品数据
echo ""
echo "📦 正在导入商品数据..."
PRODUCTS_FILE="$SCRIPT_DIR/products-all.json"

if [ -f "$PRODUCTS_FILE" ]; then
    # 读取 JSON 文件并分割成单个文档插入
    jq -c '.[]' "$PRODUCTS_FILE" | while read -r product; do
        material_code=$(echo "$product" | jq -r '.material_code')
        echo "  导入商品：$material_code"
        
        tcb db nosql execute -e "$ENV_ID" \
            --command "[{\"TableName\":\"products\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"products\\\",\\\"documents\\\":[${product}]}\"}]" \
            --json > /dev/null 2>&1
    done
    echo "✅ 商品数据导入完成"
else
    echo "❌ 找不到商品数据文件：$PRODUCTS_FILE"
fi

# 导入客户数据
echo ""
echo "📦 正在导入客户数据..."
CUSTOMERS_FILE="$SCRIPT_DIR/customers-all.json"

if [ -f "$CUSTOMERS_FILE" ]; then
    # 读取 JSON 文件并分割成单个文档插入
    jq -c '.[]' "$CUSTOMERS_FILE" | while read -r customer; do
        name=$(echo "$customer" | jq -r '.name')
        echo "  导入客户：$name"
        
        tcb db nosql execute -e "$ENV_ID" \
            --command "[{\"TableName\":\"customers\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"customers\\\",\\\"documents\\\":[${customer}]}\"}]" \
            --json > /dev/null 2>&1
    done
    echo "✅ 客户数据导入完成"
else
    echo "❌ 找不到客户数据文件：$CUSTOMERS_FILE"
fi

echo ""
echo "=========================================="
echo "✅ 数据导入完成！"
echo "=========================================="
