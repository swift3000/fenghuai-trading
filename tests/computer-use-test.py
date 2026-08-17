#!/usr/bin/env python3
"""
使用 Computer Use 自动化测试微信开发者工具
"""

import subprocess
import json
import time
import os
from datetime import datetime

PROJECT_PATH = "/Users/god/Desktop/项目/github/fenghuai-trading"
REPORT_DIR = os.path.join(PROJECT_PATH, "tests/reports")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

os.makedirs(REPORT_DIR, exist_ok=True)

def run_node_repl(code):
    """运行 Node.js 代码"""
    cmd = f'echo "{code}" | codex mcp node_repl js'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    return result.stdout, result.stderr

def main():
    print("=" * 50)
    print("  使用 Computer Use 自动化测试")
    print("=" * 50)
    
    # 使用 Computer Use 技能
    test_script = f'''
    const { computerUse } = require('@oai/sky');
    
    async function testWechatDevTools() {{
      console.log('开始自动化测试...');
      
      // 1. 打开微信开发者工具
      await computerUse.click({{ selector: '应用图标：微信开发者工具' }});
      await computerUse.wait(2000);
      
      // 2. 打开项目
      await computerUse.click({{ selector: '文件菜单' }});
      await computerUse.click({{ selector: '打开项目' }});
      await computerUse.type({{ text: '{PROJECT_PATH}' }});
      await computerUse.click({{ selector: '确认按钮' }});
      await computerUse.wait(3000);
      
      // 3. 编译项目
      await computerUse.click({{ selector: '编译按钮' }});
      await computerUse.wait(3000);
      
      // 4. 截图
      await computerUse.screenshot({{ path: '{REPORT_DIR}/login_{TIMESTAMP}.png' }});
      
      console.log('测试完成');
    }}
    
    testWechatDevTools();
    '''
    
    print("正在执行 Computer Use 测试...")
    print("注意：Computer Use 需要手动确认权限")
    print()
    print("请按照以下步骤操作:")
    print("1. 在 Codex 中选择使用 computer-use 技能")
    print("2. 授权访问微信开发者工具")
    print("3. 观察自动化测试过程")
    print()
    print("或者，你可以手动执行以下操作:")
    print("=" * 50)
    print("1. 打开微信开发者工具")
    print(f"2. 打开项目：{PROJECT_PATH}")
    print("3. 点击'编译'按钮")
    print("4. 测试各个功能页面")
    print("5. 截图保存测试结果")
    print("=" * 50)

if __name__ == "__main__":
    main()
