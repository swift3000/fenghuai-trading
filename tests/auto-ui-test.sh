#!/bin/bash

echo "=========================================="
echo "微信开发者工具自动化 UI 测试"
echo "开始时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

PROJECT_PATH="/Users/god/Desktop/项目/github/fenghuai-trading"
SCREENSHOT_DIR="$PROJECT_PATH/tests/ui-screenshots"
LOG_FILE="$PROJECT_PATH/tests/ui-test.log"

mkdir -p "$SCREENSHOT_DIR"
> "$LOG_FILE"

log() {
  echo "$1" | tee -a "$LOG_FILE"
}

# 等待应用启动
wait_app() {
  local app_name=$1
  local timeout=$2
  local count=0
  while ! osascript -e "tell application \"System Events\" to name of processes contains \"$app_name\"" 2>/dev/null | grep -q "true"; do
    sleep 1
    count=$((count + 1))
    if [ $count -gt $timeout ]; then
      log "❌ 等待 $app_name 超时"
      return 1
    fi
  done
  log "✅ $app_name 已启动"
  return 0
}

# 截图当前屏幕
take_screenshot() {
  local name=$1
  local timestamp=$(date '+%Y%m%d_%H%M%S')
  log "📸 截图：$name"
  
  # 使用 AppleScript 触发截图快捷键
  osascript << EOF
tell application "System Events"
  keystroke "3" using {control down, command down}
  delay 0.5
end tell
EOF
  
  # 移动截图到指定目录（截图默认在桌面）
  mv ~/Desktop/Screenshot\ *.png "$SCREENSHOT_DIR/${name}_${timestamp}.png" 2>/dev/null || true
  sleep 1
}

# 点击模拟器中的位置（坐标基于模拟器窗口）
click_at() {
  local x=$1
  local y=$2
  log "🖱️ 点击位置：($x, $y)"
  
  osascript << EOF
tell application "System Events"
  set frontmost of process "微信开发者工具" to true
  delay 0.5
  click at {$x, $y}
  delay 0.5
end tell
EOF
}

# 按键输入
type_text() {
  local text=$1
  log "⌨️ 输入文本：$text"
  
  osascript << EOF
tell application "System Events"
  keystroke "$text"
end tell
EOF
}

# 打开微信开发者工具
open_wechat_devtools() {
  log "\n=== 步骤 1: 打开微信开发者工具 ==="
  
  osascript << EOF
tell application "微信开发者工具"
  activate
end tell
EOF
  
  sleep 3
  wait_app "微信开发者工具" 10
}

# 打开项目
open_project() {
  log "\n=== 步骤 2: 打开项目 ==="
  
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    keystroke "o" using {command down}
    delay 1
    keystroke "$PROJECT_PATH"
    delay 0.5
    keystroke return
    delay 2
  end tell
end tell
EOF
  
  sleep 5
  take_screenshot "project-opened"
}

# 点击编译按钮
click_compile() {
  log "\n=== 步骤 3: 点击编译 ==="
  
  # 编译按钮通常在工具栏左侧
  # 这里使用模拟点击，实际坐标可能需要调整
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    set frontmost to true
    delay 0.5
    -- 尝试点击编译按钮（通常在左上角）
    click button "编译" of toolbar 1 of window 1
    delay 3
  end tell
end tell
EOF
  
  sleep 5
  take_screenshot "after-compile"
}

# 查看 Console 错误
check_console_errors() {
  log "\n=== 步骤 4: 查看 Console 错误 ==="
  
  # 切换到调试器标签
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    click tab "调试器" of tab group 1 of window 1
    delay 0.5
    click tab "Console" of tab group 2 of window 1
    delay 0.5
  end tell
end tell
EOF
  
  sleep 2
  take_screenshot "console-errors"
  
  # 尝试读取 Console 内容（可能需要额外的 AppleScript）
  log "📋 Console 截图已保存，请查看错误信息"
}

# 测试登录页
test_login_page() {
  log "\n=== 步骤 5: 测试登录页 ==="
  
  # 登录应该是默认页面
  take_screenshot "login-page"
  
  # 尝试点击登录按钮（如果存在）
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    -- 尝试点击模拟器中的登录按钮
    -- 这里需要根据实际布局调整坐标
    delay 1
  end tell
end tell
EOF
  
  sleep 2
}

# 测试首页
test_home_page() {
  log "\n=== 步骤 6: 测试首页 ==="
  
  take_screenshot "home-page"
  
  # 检查 TabBar 图标
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    -- 尝试点击底部 TabBar 的第一个图标
    delay 1
  end tell
end tell
EOF
  
  sleep 2
  take_screenshot "home-with-tabbar"
}

# 测试新建订单
test_new_order() {
  log "\n=== 步骤 7: 测试新建订单 ==="
  
  # 点击新建订单按钮
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    delay 1
    -- 点击首页的"新建订单"按钮
    delay 2
  end tell
end tell
EOF
  
  sleep 3
  take_screenshot "new-order-page"
  
  # 尝试搜索客户
  osascript << EOF
tell application "System Events"
  tell process "微信开发者工具"
    delay 1
    -- 点击客户搜索框
    delay 0.5
    keystroke "测试客户"
    delay 2
  end tell
end tell
EOF
  
  sleep 2
  take_screenshot "search-customer"
}

# 主测试流程
main() {
  log "开始自动化 UI 测试..."
  
  # 1. 打开微信开发者工具
  open_wechat_devtools
  
  # 2. 打开项目
  open_project
  
  # 3. 编译
  click_compile
  
  # 4. 查看 Console 错误
  check_console_errors
  
  # 5. 测试登录页
  test_login_page
  
  # 6. 测试首页
  test_home_page
  
  # 7. 测试新建订单
  test_new_order
  
  log "\n=========================================="
  log "UI 测试完成"
  log "结束时间：$(date '+%Y-%m-%d %H:%M:%S')"
  log "=========================================="
  log "\n截图保存在：$SCREENSHOT_DIR"
  log "日志保存在：$LOG_FILE"
}

# 运行测试
main
