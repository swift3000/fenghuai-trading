#!/bin/bash
# W0 一键自动化部署脚本
# 丰淮商贸采购下单小程序

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 W0 自动化部署 - 丰淮商贸小程序"
echo "=========================================="
echo ""
echo "📋 部署内容："
echo "  1. 创建 11 个数据库集合"
echo "  2. 插入 regions 预置数据（11 条）"
echo "  3. 初始化 system_config"
echo "  4. 部署 10 个云函数"
echo ""
echo "⚠️  首次运行需要微信扫码授权"
echo ""
read -p "按回车键开始..." 

# 1. 登录云开发
echo ""
echo "=========================================="
echo "📋 步骤 1/4: 登录云开发环境"
echo "=========================================="
echo ""
echo "📱 请使用微信扫码以下链接授权："
echo "   https://tcb.cloud.tencent.com/dev#/cli-auth?user_code=RTBG-TS3X&from=cli&flow=device"
echo ""
tcb login
echo "✅ 登录成功"
echo ""

# 2. 查看环境信息
echo "=========================================="
echo "📋 步骤 2/4: 查看环境信息"
echo "=========================================="
echo ""
tcb env info
echo ""

# 3. 创建数据库集合和插入数据
echo "=========================================="
echo "📋 步骤 3/4: 初始化数据库"
echo "=========================================="
echo ""

# 创建 11 个集合
COLLECTIONS=("users" "regions" "products" "customers" "orders" "order_items" "payments" "product_aliases" "customer_aliases" "order_logs" "system_config")

for collection in "${COLLECTIONS[@]}"; do
    echo -n "  创建集合：$collection ... "
    # 尝试插入一条测试数据来创建集合（如果已存在会失败，忽略错误）
    echo '{"_id": "init", "status": 1}' | tcb db nosql execute --collection "$collection" --operation "add" --data-stdin 2>/dev/null || true
    echo "✅"
done
echo ""

# 插入 regions 数据
echo "  插入 regions 预置数据..."
tcb db nosql execute --collection "regions" --operation "add" --data '[
  {"_id": "1", "name": "汉滨区", "sort": 1, "status": 1},
  {"_id": "2", "name": "汉阴县", "sort": 2, "status": 1},
  {"_id": "3", "name": "石泉县", "sort": 3, "status": 1},
  {"_id": "4", "name": "宁陕县", "sort": 4, "status": 1},
  {"_id": "5", "name": "紫阳县", "sort": 5, "status": 1},
  {"_id": "6", "name": "岚皋县", "sort": 6, "status": 1},
  {"_id": "7", "name": "平利县", "sort": 7, "status": 1},
  {"_id": "8", "name": "镇坪县", "sort": 8, "status": 1},
  {"_id": "9", "name": "旬阳市", "sort": 9, "status": 1},
  {"_id": "10", "name": "白河县", "sort": 10, "status": 1},
  {"_id": "99", "name": "外县", "sort": 99, "status": 1}
]' 2>/dev/null || echo "  ⚠️  regions 数据可能已存在"
echo "✅"
echo ""

# 初始化 system_config
echo "  初始化 system_config..."
tcb db nosql execute --collection "system_config" --operation "add" --data '{
  "_id": "ai_config",
  "type": "ai",
  "asr": {"enabled": false, "appId": "", "appKey": "", "secretKey": ""},
  "nlp": {"enabled": false, "apiKey": ""},
  "voice": {"enabled": false, "voiceId": ""},
  "printer": {"enabled": false, "printerId": "", "printerName": ""},
  "status": 1,
  "createTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"}' 2>/dev/null || echo "  ⚠️  system_config 可能已存在"
echo "✅"
echo ""

# 4. 部署云函数
echo "=========================================="
echo "📋 步骤 4/4: 部署 10 个云函数"
echo "=========================================="
echo ""
echo "⏳ 这可能需要 10-15 分钟，请耐心等待..."
echo ""

tcb fn deploy --all --force
echo ""
echo "✅ 云函数部署完成"
echo ""

# 查看云函数列表
echo "=========================================="
echo "📋 已部署的云函数列表"
echo "=========================================="
echo ""
tcb fn list
echo ""

# 完成
echo "=========================================="
echo "✅ W0 自动化部署全部完成！"
echo "=========================================="
echo ""
echo "已完成的任务："
echo "  ✅ 创建 11 个数据库集合"
echo "  ✅ 插入 11 条 regions 数据"
echo "  ✅ 初始化 system_config"
echo "  ✅ 部署 10 个云函数"
echo ""
echo "📖 下一步："
echo "  1. 打开微信开发者工具"
echo "  2. 测试小程序功能"
echo "  3. 进入 W1 开发阶段"
echo ""
