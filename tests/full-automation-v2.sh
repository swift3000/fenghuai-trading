#!/bin/bash
# 全功能自动化测试 v2

PROJECT="/Users/god/Desktop/项目/github/fenghuai-trading"
REPORT_DIR="$PROJECT/tests/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WDA="$HOME/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"

mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "  🚀 微信小程序全功能自动化测试 v2"
echo "  时间：$TIMESTAMP"
echo "=========================================="
echo ""

# 初始化报告
cat > "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md" << 'HEADER'
# 微信小程序全功能自动化测试报告

HEADER

echo "测试时间：$(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "项目：fenghuai-trading" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "## 页面测试概览" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "| 模块 | 页面 | 状态 | 截图 |" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "|------|------|------|------|" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"

# 页面列表
PAGES=(
    "login:登录模块:pages/login/login"
    "首页：首页:pages/index/index"
    "新建订单：新建订单:pages/new-order/new-order"
    "订单列表：订单列表:pages/orders/orders"
    "订单详情：订单详情:pages/order-detail/order-detail"
    "商品管理：商品管理:pages/products/products"
    "客户管理：客户管理:pages/customers/customers"
    "赊销管理：赊销管理:pages/receivable/receivable"
    "分拣出库：分拣出库:pages/outbound/outbound"
    "报表导出：报表导出:pages/reports/reports"
    "成员管理：成员管理:pages/members/members"
    "个人中心：个人中心:pages/profile/profile"
    "设置：设置:pages/settings/settings"
)

# 测试每个页面
for item in "${PAGES[@]}"; do
    IFS=':' read -r module page route <<< "$item"
    
    echo "📱 测试：$module ($page)"
    
    SCREENSHOT="$REPORT_DIR/${page//\//_}_${TIMESTAMP}.png"
    
    # 截图
    if $WDA shot --project "$PROJECT" --route "$route" --output "$SCREENSHOT" 2>&1 | grep -q "ARTIFACT"; then
        echo "  ✅ 成功"
        echo "| $module | $page | ✅ | [查看](${SCREENSHOT}) |" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
    else
        echo "  ⚠️  失败"
        echo "| $module | $page | ⚠️ | - |" >> "$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
    fi
    
    sleep 1
done

echo ""
echo "=========================================="
echo "  ✅ 测试完成"
echo "=========================================="
echo ""
echo "📊 报告：$REPORT_DIR/全功能测试报告_${TIMESTAMP}.md"
echo "📸 截图：$REPORT_DIR/"
echo ""
ls -lt "$REPORT_DIR"/*_${TIMESTAMP}.png 2>/dev/null | head -15
