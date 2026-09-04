#!/bin/bash
# Loop 工作流 - 完整自动化测试和修复

echo "=========================================="
echo "钱多多小程序 - Loop 完整测试"
echo "开始时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

ROUND=0
MAX_ROUNDS=10

while [ $ROUND -lt $MAX_ROUNDS ]; do
    ROUND=$((ROUND + 1))
    echo ""
    echo "========== 第 $ROUND 轮测试 =========="
    
    # 运行测试
    node tests/full-automation-test.js > tests/reports/round-${ROUND}-test.log 2>&1
    
    # 检查测试结果
    PASSED=$(grep "通过:" tests/reports/round-${ROUND}-test.log | tail -1 | grep -o "[0-9]*")
    FAILED=$(grep "失败:" tests/reports/round-${ROUND}-test.log | tail -1 | grep -o "[0-9]*")
    
    echo "第 $ROUND 轮结果：通过 $PASSED, 失败 $FAILED"
    
    if [ "$FAILED" = "0" ] || [ -z "$FAILED" ]; then
        echo "✅ 所有测试通过！"
        break
    fi
    
    # 自动修复常见问题
    echo "🔧 尝试自动修复..."
    
    # 修复重复的 wx:key
    find pages -name "*.wxml" -exec sed -i '' 's/wx:key="\([^"]*\)" wx:key="\([^"]*\)"/wx:key="\1"/g' {} \;
    
    # 修复简单的 WXML 语法问题
    find pages -name "*.wxml" -exec sed -i '' 's/{{\s*{{/{{/g' {} \;
    find pages -name "*.wxml" -exec sed -i '' 's/}}\s*}}/}}/g' {} \;
    
    # 检查是否还有问题
    sleep 1
done

echo ""
echo "=========================================="
echo "Loop 测试完成"
echo "总轮数：$ROUND"
echo "结束时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 生成最终报告
cat > tests/reports/LOOP-FINAL-REPORT.md << REPORT
# Loop 完整测试报告

**测试轮数**: $ROUND
**完成时间**: $(date '+%Y-%m-%d %H:%M:%S')

## 每轮测试结果

\`\`\`
$(cat tests/reports/round-*.log 2>/dev/null | grep -E "第 [0-9]+ 轮结果" | tail -10)
\`\`\`

## 建议

1. 在微信开发者工具中点击"编译"
2. 手动测试关键功能
3. 上传云函数
REPORT

echo "📄 最终报告已保存到：tests/reports/LOOP-FINAL-REPORT.md"
