#!/bin/bash
# 自动化上传云函数脚本
# 使用微信开发者工具 CLI 进行批量上传

PROJECT_DIR="/Users/god/Desktop/项目/github/fenghuai-trading"
CLOUDFUNCTIONS_DIR="$PROJECT_DIR/cloudfunctions"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

echo "🚀 开始自动化上传云函数..."
echo "项目目录：$PROJECT_DIR"
echo "云函数目录：$CLOUDFUNCTIONS_DIR"

# 检查 CLI 是否存在
if [ ! -f "$CLI" ]; then
    echo "❌ 错误：微信开发者工具 CLI 不存在"
    exit 1
fi

# 获取所有云函数目录
FUNCTIONS=$(find "$CLOUDFUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \;)

echo ""
echo "📦 发现云函数:"
echo "$FUNCTIONS" | while read func; do
    echo "  - $func"
done

echo ""
echo "⚠️ 注意：微信开发者工具 CLI 不支持直接上传云函数"
echo "需要通过 IDE GUI 操作或使用 CloudBase CLI"
echo ""
echo "建议操作:"
echo "1. 打开微信开发者工具"
echo "2. 右键 cloudfunctions 文件夹"
echo "3. 选择 '上传并部署：云端安装依赖 (不上传 node_modules)'"
echo ""
echo "或者使用 CloudBase CLI (需要安装):"
echo "  npm install -g @cloudbase/cli"
echo "  tcb fn deploy --dir $CLOUDFUNCTIONS_DIR"

