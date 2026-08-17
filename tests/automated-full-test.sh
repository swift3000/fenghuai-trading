#!/bin/bash

echo "=========================================="
echo "🚀 丰淮商贸小程序 - 全自动化测试"
echo "=========================================="
echo ""

PROJECT_PATH="/Users/god/Desktop/项目/github/fenghuai-trading"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
TEST_DIR="/tmp/wechat_full_test_$(date +%s)"

mkdir -p "$TEST_DIR"

echo "📦 步骤 1: 编译项目..."
$CLI --project "$PROJECT_PATH" compile 2>&1 | tee "$TEST_DIR/compile.log"
echo ""

echo "📸 步骤 2: 截图测试..."
$CLI --project "$PROJECT_PATH" preview --screenshot "$TEST_DIR/01_login.png" &
sleep 2
$CLI --project "$PROJECT_PATH" preview --screenshot "$TEST_DIR/02_index.png" &
sleep 2
wait

echo "✅ 测试完成！结果保存在：$TEST_DIR"
open "$TEST_DIR"
