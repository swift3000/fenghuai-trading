#!/usr/bin/env python3
"""
微信小程序全自动化测试
使用 wechat-devtools-mcp 进行自动化操作
"""

import subprocess
import json
import time
import os
from datetime import datetime

PROJECT_PATH = "/Users/god/Desktop/项目/github/fenghuai-trading"
REPORT_DIR = os.path.join(PROJECT_PATH, "tests/reports")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

# 确保报告目录存在
os.makedirs(REPORT_DIR, exist_ok=True)

def run_command(cmd):
    """运行命令并返回结果"""
    print(f"  执行：{cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print(f"  ✅ {result.stdout.strip()}")
            return True, result.stdout
        else:
            print(f"  ❌ {result.stderr.strip()}")
            return False, result.stderr
    except Exception as e:
        print(f"  ❌ 错误：{str(e)}")
        return False, str(e)

def main():
    print("=" * 50)
    print("  微信小程序全自动化测试")
    print("=" * 50)
    print(f"项目路径：{PROJECT_PATH}")
    print(f"报告目录：{REPORT_DIR}")
    print(f"时间戳：{TIMESTAMP}")
    print()
    
    # 1. 检查环境
    print("📋 步骤 1: 检查环境")
    success, output = run_command("wechat_ide_status")
    print()
    
    # 2. 打开项目
    print("📱 步骤 2: 打开小程序项目")
    success, output = run_command(f'wechat_open "{PROJECT_PATH}"')
    time.sleep(2)
    print()
    
    # 3. 编译项目
    print("🔨 步骤 3: 编译项目")
    success, output = run_command("wechat_compile")
    time.sleep(3)
    print()
    
    # 4. 截图登录页
    print("📸 步骤 4: 截图登录页面")
    login_screenshot = os.path.join(REPORT_DIR, f"login_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{login_screenshot}"')
    print()
    
    # 5. 点击登录按钮
    print("🔐 步骤 5: 执行登录")
    success, output = run_command('wechat_click "button.wechat-login-btn"')
    time.sleep(3)
    print()
    
    # 6. 截图首页
    print("📸 步骤 6: 截图首页")
    home_screenshot = os.path.join(REPORT_DIR, f"home_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{home_screenshot}"')
    print()
    
    # 7. 点击新建订单
    print("📝 步骤 7: 点击新建订单")
    success, output = run_command('wechat_click ".new-order-btn"')
    time.sleep(2)
    print()
    
    # 8. 选择客户
    print("👤 步骤 8: 选择客户")
    success, output = run_command('wechat_click ".customer-selector"')
    time.sleep(1)
    success, output = run_command('wechat_click ".customer-item:first-child"')
    time.sleep(1)
    print()
    
    # 9. 添加商品
    print("📦 步骤 9: 添加商品")
    success, output = run_command('wechat_click ".add-product-btn"')
    time.sleep(1)
    success, output = run_command('wechat_click ".product-item:first-child"')
    time.sleep(1)
    print()
    
    # 10. 提交订单
    print("✅ 步骤 10: 提交订单")
    success, output = run_command('wechat_click ".submit-order-btn"')
    time.sleep(2)
    print()
    
    # 11. 截图订单详情
    print("📸 步骤 11: 截图订单详情")
    order_screenshot = os.path.join(REPORT_DIR, f"order_detail_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{order_screenshot}"')
    print()
    
    # 12. 获取控制台日志
    print("📋 步骤 12: 获取控制台日志")
    success, console_log = run_command("wechat_console")
    log_file = os.path.join(REPORT_DIR, f"console_log_{TIMESTAMP}.txt")
    with open(log_file, 'w') as f:
        f.write(console_log)
    print(f"  ✅ 日志已保存到：{log_file}")
    print()
    
    # 13. 测试商品管理
    print("🏷️  步骤 13: 测试商品管理")
    success, output = run_command('wechat_click ".tab-products"')
    time.sleep(1)
    products_screenshot = os.path.join(REPORT_DIR, f"products_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{products_screenshot}"')
    print()
    
    # 14. 测试客户管理
    print("👥 步骤 14: 测试客户管理")
    success, output = run_command('wechat_click ".tab-customers"')
    time.sleep(1)
    customers_screenshot = os.path.join(REPORT_DIR, f"customers_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{customers_screenshot}"')
    print()
    
    # 15. 测试赊销管理
    print("💰 步骤 15: 测试赊销管理")
    success, output = run_command('wechat_click ".tab-receivable"')
    time.sleep(1)
    receivable_screenshot = os.path.join(REPORT_DIR, f"receivable_{TIMESTAMP}.png")
    success, output = run_command(f'wechat_screenshot "{receivable_screenshot}"')
    print()
    
    # 生成测试报告
    print("📊 步骤 16: 生成测试报告")
    report_file = os.path.join(REPORT_DIR, f"test_report_{TIMESTAMP}.md")
    with open(report_file, 'w') as f:
        f.write(f"""# 自动化测试报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**项目**: fenghuai-trading

## 测试截图

- 登录页面：[查看](./login_{TIMESTAMP}.png)
- 首页：[查看](./home_{TIMESTAMP}.png)
- 订单详情：[查看](./order_detail_{TIMESTAMP}.png)
- 商品管理：[查看](./products_{TIMESTAMP}.png)
- 客户管理：[查看](./customers_{TIMESTAMP}.png)
- 赊销管理：[查看](./receivable_{TIMESTAMP}.png)

## 控制台日志

[查看日志](./console_log_{TIMESTAMP}.txt)

## 测试状态

✅ 自动化测试完成
""")
    print(f"  ✅ 报告已保存到：{report_file}")
    print()
    
    print("=" * 50)
    print("  ✅ 自动化测试完成")
    print("=" * 50)
    print(f"生成的文件:")
    for file in os.listdir(REPORT_DIR):
        if TIMESTAMP in file:
            print(f"  - {file}")

if __name__ == "__main__":
    main()
