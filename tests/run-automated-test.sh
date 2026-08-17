#!/bin/bash
# 微信小程序自动化测试脚本

PROJECT_PATH="$(pwd)"
REPORT_DIR="tests/reports"
TIMESTAMP="20260814_$(date +%H%M%S)"
WDA="$HOME/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"

mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "微信小程序自动化测试开始"
echo "时间：$TIMESTAMP"
echo "项目：$PROJECT_PATH"
echo "=========================================="

# 测试页面列表
PAGES=(
    "login:登录页面"
    "index:首页"
    "orders:订单列表"
    "new-order:新建订单"
    "order-detail:订单详情"
    "products:商品管理"
    "customers:客户管理"
    "receivable:赊销管理"
    "outbound:分拣出库"
    "reports:报表导出"
    "profile:我的"
    "members:成员管理"
    "settings:设置"
)

# 记录测试结果
PASS_COUNT=0
FAIL_COUNT=0

for page_info in "${PAGES[@]}"; do
    IFS=':' read -r route page_name <<< "$page_info"
    OUTPUT_FILE="$REPORT_DIR/${page_name}_$TIMESTAMP.png"
    
    echo ""
    echo "测试页面：$page_name ($route)"
    
    # 尝试截图
    if "$WDA" shot --project "$PROJECT_PATH" --route "pages/$route/$route" --output "$OUTPUT_FILE" 2>&1 | tee /tmp/wda_log.txt; then
        if [ -f "$OUTPUT_FILE" ]; then
            echo "✓ 截图成功：$OUTPUT_FILE"
            ((PASS_COUNT++))
        else
            echo "✗ 截图失败：文件未生成"
            ((FAIL_COUNT++))
        fi
    else
        echo "✗ 截图失败：命令执行错误"
        ((FAIL_COUNT++))
    fi
    
    sleep 2
done

echo ""
echo "=========================================="
echo "测试完成"
echo "成功：$PASS_COUNT"
echo "失败：$FAIL_COUNT"
echo "报告目录：$REPORT_DIR"
echo "=========================================="

# 获取控制台日志
echo ""
echo "获取控制台日志..."
"$WDA" console --project "$PROJECT_PATH" --output "$REPORT_DIR/console_$TIMESTAMP.txt" 2>&1

echo ""
echo "测试报告已生成在：$REPORT_DIR/"
ls -lht "$REPORT_DIR"/*.png 2>/dev/null | head -20
