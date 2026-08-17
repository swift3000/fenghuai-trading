#!/bin/bash
set -e

PROJECT_DIR="/Users/god/Desktop/项目/github/fenghuai-trading"
AUTOMATOR="/Users/god/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"
OUTPUT_DIR="$PROJECT_DIR/output/full-auto-test-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "🚀 开始完整自动化测试流程..."
echo "================================"
echo "项目：$PROJECT_DIR"
echo "输出：$OUTPUT_DIR"
echo ""

# 测试页面列表
PAGES=(
    "pages/index/index:首页 - 仪表盘"
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

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试每个页面
for page_entry in "${PAGES[@]}"; do
    IFS=':' read -r route name <<< "$page_entry"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo ""
    echo "📱 测试 [$TOTAL_TESTS]: $name"
    echo "   路由：$route"
    
    # 截图测试
    OUTPUT_FILE="$OUTPUT_DIR/${name}.png"
    LOG_FILE="/tmp/test_${name}.log"
    
    if $AUTOMATOR shot \
        --project "$PROJECT_DIR" \
        --route "$route" \
        2>&1 | tee "$LOG_FILE" | grep -q "ARTIFACT kind=page"; then
        
        # 检查控制台日志
        if grep -q "level=error" "$LOG_FILE"; then
            echo "   ⚠️  页面加载但有错误日志"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        else
            echo "   ✅ 页面正常"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
        
        # 复制截图到输出目录
        LATEST_SCREENSHOT=$(grep "ARTIFACT kind=page" "$LOG_FILE" | sed 's/.*path=//' | tail -1)
        if [ -f "$LATEST_SCREENSHOT" ]; then
            cp "$LATEST_SCREENSHOT" "$OUTPUT_FILE"
        fi
    else
        echo "   ❌ 截图失败"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    sleep 1
done

# 计算成功率
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
    SUCCESS_RATE=0
fi

# 生成测试报告
echo ""
echo "================================"
echo "📊 测试完成！"
echo "================================"
echo ""
echo "测试结果:"
echo "  总测试数：$TOTAL_TESTS"
echo "  通过：$PASSED_TESTS"
echo "  失败：$FAILED_TESTS"
echo "  成功率：${SUCCESS_RATE}%"
echo ""
echo "截图保存在：$OUTPUT_DIR"
echo ""

# 生成 Markdown 报告
REPORT_FILE="$OUTPUT_DIR/test-report.md"
cat > "$REPORT_FILE" << REPORT
# 自动化测试报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**项目**: 丰淮商贸采购下单助手

## 测试概览

| 指标 | 数量 |
|------|------|
| 总测试数 | $TOTAL_TESTS |
| 通过 | $PASSED_TESTS |
| 失败 | $FAILED_TESTS |
| 成功率 | ${SUCCESS_RATE}% |

## 测试详情

| 页面 | 路由 | 状态 |
|------|------|------|
REPORT

for page_entry in "${PAGES[@]}"; do
    IFS=':' read -r route name <<< "$page_entry"
    screenshot="$OUTPUT_DIR/${name}.png"
    if [ -f "$screenshot" ]; then
        echo "| $name | $route | ✅ |" >> "$REPORT_FILE"
    else
        echo "| $name | $route | ❌ |" >> "$REPORT_FILE"
    fi
done

echo "" >> "$REPORT_FILE"
echo "## 下一步行动" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. 对比截图与原型图，检查 UI 差异"
echo "2. 修复控制台错误日志"
echo "3. 验证云函数是否已部署"
echo "4. 测试完整业务流程"

echo ""
echo "📄 详细报告：$REPORT_FILE"
echo ""
echo "✅ 自动化测试完成！"

