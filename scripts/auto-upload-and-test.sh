#!/bin/bash
set -e

PROJECT_DIR="/Users/god/Desktop/项目/github/fenghuai-trading"
CLOUDFUNCTIONS_DIR="$PROJECT_DIR/cloudfunctions"
IDE_APP="wechatwebdevtools"

echo "🚀 开始自动化云函数上传和测试流程..."
echo "================================"

# 步骤 1: 检查并打开微信开发者工具
echo ""
echo "📱 步骤 1: 检查微信开发者工具..."

# 检查应用是否运行
if pgrep -x "wechatwebdevtools" > /dev/null; then
    echo "✅ 微信开发者工具已在运行"
else
    echo "🔄 启动微信开发者工具..."
    open -a "wechatwebdevtools"
    sleep 5
fi

# 步骤 2: 使用 AppleScript 自动上传云函数
echo ""
echo "📦 步骤 2: 自动化上传云函数..."

cat > /tmp/upload_functions.applescript << 'APPLESCRIPT'
-- 自动化上传云函数的 AppleScript
tell application "System Events"
    -- 确保微信开发者工具在前台
    tell application "wechatwebdevtools"
        activate
        delay 2
    end tell
    
    -- 点击左侧资源管理器中的 cloudfunctions 文件夹
    -- 假设焦点已在微信开发者工具窗口
    delay 1
    
    -- 使用键盘快捷键 Command+Shift+C 快速定位到云函数（如果有）
    -- 或者通过菜单操作
    
    -- 方法 1: 右键点击 cloudfunctions 文件夹
    -- 首先需要定位到文件列表区域
    -- 这取决于微信开发者工具的 UI 结构
    
    -- 由于 UI 可能变化，使用更稳健的方法：
    -- 通过菜单栏操作
    
    -- 尝试使用快捷键或菜单
    -- 先确保在正确的项目窗口
    key code 3 using command down  -- Command+1 (切换到项目视图)
    delay 1
    
    -- 定位到 cloudfunctions 文件夹
    -- 这需要更精确的 UI 树查询
    -- 暂时使用通用方法
    
end tell

-- 由于 UI 自动化复杂性，建议使用 CLI 或手动操作
-- 这里提供一个替代方案：使用微信开发者工具的命令行接口

tell application "System Events"
    tell application "wechatwebdevtools"
        activate
        delay 3
    end tell
    
    -- 尝试通过菜单上传
    -- 菜单路径：云开发 -> 云函数 -> 上传并部署
    
    -- 点击菜单栏
    keystroke "c" using {command down, shift down}  -- 可能打开编译菜单
    delay 2
    
end tell
APPLESCRIPT

echo "⚠️ 注意：微信开发者工具的 UI 自动化比较复杂"
echo "   由于 UI 结构变化频繁，纯 AppleScript 可能不稳定"
echo ""
echo "💡 推荐方案：使用微信开发者工具的 CLI + 自动化脚本"
echo ""

# 步骤 3: 检查是否有云函数需要上传
echo "🔍 检查云函数状态..."
FUNCTION_COUNT=$(find "$CLOUDFUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "   发现 $FUNCTION_COUNT 个云函数目录"

if [ "$FUNCTION_COUNT" -eq 0 ]; then
    echo "❌ 未找到云函数目录"
    exit 1
fi

echo ""
echo "📋 云函数列表:"
find "$CLOUDFUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | while read func; do
    echo "   - $func"
done

# 步骤 4: 生成上传指南
echo ""
echo "📝 自动化上传方案:"
echo ""
echo "由于微信开发者工具的 UI 自动化复杂，推荐以下方案:"
echo ""
echo "方案 A (推荐): 使用 CloudBase CLI"
echo "  1. 安装：npm install -g @cloudbase/cli"
echo "  2. 登录：tcb login"
echo "  3. 部署：cd $CLOUDFUNCTIONS_DIR && for f in */; do tcb fn deploy \${f%/} --dir .; done"
echo ""
echo "方案 B: 手动一次上传（之后可自动化测试）"
echo "  在微信开发者工具中:"
echo "  1. 右键 cloudfunctions 文件夹"
echo "  2. 选择 '上传并部署：云端安装依赖'"
echo ""
echo "方案 C: 使用 Computer Use 技能（需要安装）"
echo "  可以完全自动化 GUI 操作"
echo ""

# 步骤 5: 准备自动化测试脚本
echo ""
echo "🧪 准备自动化测试..."

cat > "$PROJECT_DIR/scripts/run-prototype-test.sh" << 'TESTSCRIPT'
#!/bin/bash
# 基于原型的自动化测试脚本

PROJECT_DIR="/Users/god/Desktop/项目/github/fenghuai-trading"
AUTOMATOR="/Users/god/.codex/skills/wechat-devtools-automator/scripts/wechat_devtools_automator.sh"
PROTOTYPE_DIR="$PROJECT_DIR/docs/ui"
OUTPUT_DIR="$PROJECT_DIR/.local/output/prototype-test-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "🧪 开始原型对比测试..."
echo "输出目录：$OUTPUT_DIR"

# 定义测试用例（基于原型定义）
declare -A TEST_CASES=(
    ["pages/index/index"]="首页-仪表盘"
    ["pages/login/login"]="登录页"
    ["pages/orders/orders"]="订单列表"
    ["pages/new-order/new-order"]="新建订单"
    ["pages/order-detail/order-detail"]="订单详情"
    ["pages/products/products"]="商品管理"
    ["pages/customers/customers"]="客户管理"
    ["pages/receivable/receivable"]="赊销管理"
    ["pages/outbound/outbound"]="分拣出库"
    ["pages/reports/reports"]="报表统计"
    ["pages/members/members"]="成员管理"
    ["pages/profile/profile"]="我的"
)

# 测试每个页面
for route in "${!TEST_CASES[@]}"; do
    name="${TEST_CASES[$route]}"
    echo ""
    echo "📱 测试：$name"
    
    $AUTOMATOR shot \
        --project "$PROJECT_DIR" \
        --route "$route" \
        --output "$OUTPUT_DIR/${name}.png" 2>&1 | grep -E "(ARTIFACT|Error|FAIL)" || true
    
    if [ -f "$OUTPUT_DIR/${name}.png" ]; then
        echo "   ✅ 截图成功"
    else
        echo "   ❌ 截图失败"
    fi
done

echo ""
echo "🎉 测试完成！"
echo "截图保存在：$OUTPUT_DIR"
echo ""
echo "下一步:"
echo "1. 对比截图与原型图"
echo "2. 记录差异"
echo "3. 修复问题"
TESTSCRIPT

chmod +x "$PROJECT_DIR/scripts/run-prototype-test.sh"

echo ""
echo "✅ 自动化测试脚本已准备：$PROJECT_DIR/scripts/run-prototype-test.sh"
echo ""
echo "================================"
echo "📌 下一步行动:"
echo ""
echo "请选择一个方案继续:"
echo ""
echo "1. 安装 CloudBase CLI 并自动部署云函数"
echo "2. 手动上传云函数（一次），然后运行自动化测试"
echo "3. 安装 Computer Use 技能实现完全 GUI 自动化"
echo ""
echo "输入选项 (1/2/3): "
read -r option

case $option in
    1)
        echo ""
        echo "🚀 开始安装 CloudBase CLI..."
        npm install -g @cloudbase/cli
        echo ""
        echo "请登录：tcb login"
        echo "然后运行：cd $CLOUDFUNCTIONS_DIR && for f in */; do tcb fn deploy \${f%/} --dir .; done"
        ;;
    2)
        echo ""
        echo "💡 请在微信开发者工具中手动上传云函数"
        echo "完成后运行：$PROJECT_DIR/scripts/run-prototype-test.sh"
        ;;
    3)
        echo ""
        echo "🔧 安装 Computer Use 技能..."
        echo "需要确认安装计算机控制技能"
        ;;
    *)
        echo "无效选项"
        ;;
esac

