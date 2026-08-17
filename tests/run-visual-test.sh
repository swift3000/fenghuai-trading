#!/bin/bash

echo "🚀 开始可视化自动化测试..."

# 使用 AppleScript 控制微信开发者工具
osascript << 'APPLESCRIPT'
tell application "微信开发者工具"
    activate
    delay 2
    
    -- 点击编译按钮
    click menu bar item "编译" of menu bar 1
    
    delay 5
    
    -- 截图
    tell application "System Events"
        -- 截取当前屏幕
        keystroke "5" using {command down, shift down}
        delay 1
    end tell
end tell
APPLESCRIPT

echo "✅ 测试完成"
