#!/bin/bash
# 一键诊断工具
# 快速检查所有配置和依赖

echo "=========================================="
echo "  微信小程序自动化测试 - 一键诊断"
echo "=========================================="
echo ""

PROJECT_ROOT="/Users/god/Desktop/项目/github/fenghuai-trading"
PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  
  if eval "$cmd" > /dev/null 2>&1; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name"
    ((FAIL++))
  fi
}

echo "📋 环境检查"
echo "────────────────────────────────────"
check "项目目录存在" "[ -d '$PROJECT_ROOT' ]"
check "Node.js 可用" "command -v node"
check "微信 CLI 存在" "[ -f '/Applications/wechatwebdevtools.app/Contents/MacOS/cli' ]"
check "app.json 存在" "[ -f '$PROJECT_ROOT/app.json' ]"
check "云函数目录存在" "[ -d '$PROJECT_ROOT/cloudfunctions' ]"
echo ""

echo "🔧 工具检查"
echo "────────────────────────────────────"
check "wechat-devtools-mcp 配置" "grep -q 'wechat-devtools' ~/.codex/config.toml 2>/dev/null"
check "测试脚本目录" "[ -d '$PROJECT_ROOT/tests' ]"
check "upload-cloudfunctions.js" "[ -f '$PROJECT_ROOT/tests/upload-cloudfunctions.js' ]"
check "integrated-test.js" "[ -f '$PROJECT_ROOT/tests/integrated-test.js' ]"
check "run-full-automation.sh" "[ -x '$PROJECT_ROOT/tests/run-full-automation.sh' ]"
echo ""

echo "📜 脚本检查"
echo "────────────────────────────────────"
for script in auto-test.js complete-ui-test.js integrated-test.js upload-cloudfunctions.js; do
  check "$script" "[ -f '$PROJECT_ROOT/tests/$script' ]"
done
echo ""

echo "📄 文档检查"
echo "────────────────────────────────────"
for doc in "自动化测试配置说明.md" "快速开始.md" "AGENTS.md"; do
  check "$doc" "[ -f '$PROJECT_ROOT/$doc' ]"
done
echo ""

echo "🔍 代码质量检查"
echo "────────────────────────────────────"

# 检查 getApp 未定义
getapp_errors=$(grep -r "getApp is not defined" "$PROJECT_ROOT/pages" 2>/dev/null | wc -l)
if [ "$getapp_errors" -eq 0 ]; then
  echo "✅ getApp 定义正常"
  ((PASS++))
else
  echo "❌ 发现 $getapp_errors 处 getApp 未定义"
  ((FAIL++))
fi

# 检查 Page 未定义
page_errors=$(grep -r "Page is not defined" "$PROJECT_ROOT/pages" 2>/dev/null | wc -l)
if [ "$page_errors" -eq 0 ]; then
  echo "✅ Page 定义正常"
  ((PASS++))
else
  echo "❌ 发现 $page_errors 处 Page 未定义"
  ((FAIL++))
fi

# 检查 wx:key
wxkey_warnings=$(grep -r "wx:for" "$PROJECT_ROOT/pages" 2>/dev/null | grep -v "wx:key" | wc -l)
if [ "$wxkey_warnings" -eq 0 ]; then
  echo "✅ wx:key 配置完整"
  ((PASS++))
else
  echo "⚠️  发现 $wxkey_warnings 处缺少 wx:key"
fi

# 检查云函数配置
missing_config=0
for func in $(ls "$PROJECT_ROOT/cloudfunctions"); do
  if [ ! -f "$PROJECT_ROOT/cloudfunctions/$func/config.json" ]; then
    ((missing_config++))
  fi
done
if [ "$missing_config" -eq 0 ]; then
  echo "✅ 云函数配置完整"
  ((PASS++))
else
  echo "❌ 发现 $missing_config 个云函数缺少 config.json"
  ((FAIL++))
fi
echo ""

echo "=========================================="
echo "  诊断结果"
echo "=========================================="
echo "✅ 通过：$PASS"
echo "❌ 失败：$FAIL"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "🎉 所有检查通过！可以开始使用自动化测试"
  echo ""
  echo "运行完整测试："
  echo "  ./tests/run-full-automation.sh"
else
  echo "⚠️  发现一些问题，请根据上述提示进行修复"
fi
echo "=========================================="
