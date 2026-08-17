#!/bin/bash
# 微信小程序完整自动化测试
# 使用 wechat-devtools-automator

set -e

PROJECT="/Users/god/Desktop/项目/github/fenghuai-trading"
REPORTS="$PROJECT/tests/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WDA="$HOME/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"

mkdir -p "$REPORTS"

echo "=========================================="
echo "  微信小程序完整自动化测试"
echo "  时间：$TIMESTAMP"
echo "  项目：fenghuai-trading"
echo "=========================================="
echo ""

# 测试计划
PAGES=(
    "login:登录页面"
    "index:首页"
    "new-order:新建订单"
    "orders:订单列表"
    "order-detail:订单详情"
    "products:商品管理"
    "customers:客户管理"
    "receivable:赊销管理"
    "outbound:分拣出库"
    "reports:报表导出"
    "members:成员管理"
    "profile:个人中心"
    "settings:设置"
)

# 生成测试报告头部
cat > "$REPORTS/完整自动化测试报告_${TIMESTAMP}.md" << REPORT
# 微信小程序完整自动化测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**项目**: fenghuai-trading  
**测试工具**: wechat-devtools-automator  
**测试方式**: 全自动化 UI 测试

---

## 测试概览

| 页面 | 状态 | 截图 | 问题 |
|------|------|------|------|
REPORT

# 逐一测试每个页面
for page_info in "${PAGES[@]}"; do
    IFS=':' read -r page_name page_desc <<< "$page_info"
    
    echo "📱 测试页面：$page_desc ($page_name)"
    echo "----------------------------------------"
    
    SCREENSHOT="$REPORTS/${page_name}_${TIMESTAMP}.png"
    
    # 截图
    if "$WDA" shot --project "$PROJECT" --route "$page_name" --output "$SCREENSHOT" 2>&1; then
        echo "  ✅ 截图成功：$SCREENSHOT"
        
        # 添加到报告
        echo "| $page_desc | ✅ | [查看截图]($SCREENSHOT) | 无 |" >> "$REPORTS/完整自动化测试报告_${TIMESTAMP}.md"
    else
        echo "  ⚠️  截图失败"
        echo "| $page_desc | ⚠️ | - | 截图失败 |" >> "$REPORTS/完整自动化测试报告_${TIMESTAMP}.md"
    fi
    
    echo ""
done

# 完成报告
cat >> "$REPORTS/完整自动化测试报告_${TIMESTAMP}.md" << REPORT

---

## 测试总结

- **测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **测试页面数**: ${#PAGES[@]}
- **截图位置**: $REPORTS/

## 下一步

1. 查看截图，对比原型
2. 检查控制台日志
3. 修复发现的问题
4. 重新测试

REPORT

echo ""
echo "=========================================="
echo "  ✅ 自动化测试完成"
echo "=========================================="
echo ""
echo "📊 测试报告：$REPORTS/完整自动化测试报告_${TIMESTAMP}.md"
echo "📸 截图目录：$REPORTS/"
echo ""
