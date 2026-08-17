#!/bin/bash
set -e

PROJECT="/Users/god/Desktop/项目/github/fenghuai-trading"
AUTOMATOR="/Users/god/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"
OUTPUT_DIR="$PROJECT/output/full-test-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "🚀 开始完整测试..."
echo "输出目录：$OUTPUT_DIR"

# 测试页面列表
PAGES=(
    "pages/index/index:首页"
    "pages/login/login:登录页"
    "pages/orders/orders:订单列表"
    "pages/new-order/new-order:新建订单"
    "pages/order-detail/order-detail:订单详情"
    "pages/products/products:商品管理"
    "pages/customers/customers:客户管理"
    "pages/receivable/receivable:赊销管理"
    "pages/outbound/outbound:分拣出库"
    "pages/reports/reports:报表统计"
    "pages/members/members:成员管理"
    "pages/profile/profile:我的"
)

for page_info in "${PAGES[@]}"; do
    IFS=':' read -r route name <<< "$page_info"
    echo ""
    echo "📱 测试：$name ($route)"
    
    $AUTOMATOR shot \
        --project "$PROJECT" \
        --route "$route" \
        --output "$OUTPUT_DIR/${name}.png" || echo "❌ $name 测试失败"
    
    echo "✅ $name 截图完成"
done

echo ""
echo "🎉 测试完成！所有截图保存在：$OUTPUT_DIR"
