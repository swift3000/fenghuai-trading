#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信小程序自动化测试报告生成器
"""

import os
import json
from datetime import datetime

PROJECT_ROOT = "/Users/god/Desktop/项目/github/fenghuai-trading"
REPORT_DIR = os.path.join(PROJECT_ROOT, "tests/reports")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

# 页面配置
PAGES = {
    "login": {"name": "登录页面", "tabbar": False, "status": "pending"},
    "index": {"name": "首页", "tabbar": True, "status": "pending"},
    "orders": {"name": "订单列表", "tabbar": True, "status": "pending"},
    "new-order": {"name": "新建订单", "tabbar": False, "status": "pending"},
    "order-detail": {"name": "订单详情", "tabbar": False, "status": "pending"},
    "products": {"name": "商品管理", "tabbar": False, "status": "pending"},
    "customers": {"name": "客户管理", "tabbar": False, "status": "pending"},
    "receivable": {"name": "赊销管理", "tabbar": True, "status": "pending"},
    "outbound": {"name": "分拣出库", "tabbar": True, "status": "pending"},
    "reports": {"name": "报表导出", "tabbar": False, "status": "pending"},
    "profile": {"name": "我的", "tabbar": True, "status": "pending"},
    "members": {"name": "成员管理", "tabbar": False, "status": "pending"},
    "settings": {"name": "设置", "tabbar": False, "status": "pending"},
}

# 功能检查项
FUNCTION_CHECKS = [
    ("登录功能", "登录页面是否正常显示，微信登录按钮是否可用"),
    ("首页数据展示", "今日订单、今日金额是否正确显示"),
    ("订单列表", "订单列表能否正常加载，搜索功能是否正常"),
    ("新建订单", "客户选择、商品添加、订单提交是否正常"),
    ("订单详情", "订单详情页面能否正确显示订单信息"),
    ("商品管理", "商品列表、搜索、添加/编辑商品是否正常"),
    ("客户管理", "客户列表、搜索、添加/编辑客户是否正常"),
    ("赊销管理", "客户台账、收款确认、导出功能是否正常"),
    ("分拣出库", "分拣列表、出库确认是否正常"),
    ("报表导出", "报表数据是否正确，导出功能是否正常"),
    ("成员管理", "成员列表、邀请、角色切换是否正常"),
]

def check_page_implementation(page_key):
    """检查页面实现情况"""
    page_path = os.path.join(PROJECT_ROOT, "pages", page_key, page_key)
    files = {
        "wxml": f"{page_path}.wxml",
        "wxss": f"{page_path}.wxss",
        "js": f"{page_path}.js",
        "json": f"{page_path}.json",
    }
    
    result = {"exists": True, "files": {}, "issues": []}
    
    for file_type, file_path in files.items():
        if os.path.exists(file_path):
            result["files"][file_type] = "exists"
            # 检查文件大小
            size = os.path.getsize(file_path)
            if size == 0:
                result["issues"].append(f"{file_type} 文件为空")
        else:
            result["exists"] = False
            result["files"][file_type] = "missing"
            result["issues"].append(f"{file_type} 文件缺失")
    
    return result

def check_cloud_functions():
    """检查云函数"""
    cloudfunctions_dir = os.path.join(PROJECT_ROOT, "cloudfunctions")
    if not os.path.exists(cloudfunctions_dir):
        return {"exists": False, "functions": []}
    
    functions = []
    for item in os.listdir(cloudfunctions_dir):
        item_path = os.path.join(cloudfunctions_dir, item)
        if os.path.isdir(item_path):
            index_js = os.path.join(item_path, "index.js")
            package_json = os.path.join(item_path, "package.json")
            functions.append({
                "name": item,
                "index_js": os.path.exists(index_js),
                "package_json": os.path.exists(package_json),
            })
    
    return {"exists": True, "functions": functions}

def generate_report():
    """生成测试报告"""
    os.makedirs(REPORT_DIR, exist_ok=True)
    
    report = []
    report.append("# 微信小程序自动化测试报告\n")
    report.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    report.append(f"**项目路径**: {PROJECT_ROOT}\n")
    report.append("---\n")
    
    # 1. 页面实现检查
    report.append("## 1. 页面实现检查\n")
    report.append("| 页面 | 状态 | WXML | WXSS | JS | JSON | 问题 |\n")
    report.append("|------|------|------|------|------|------|------|\n")
    
    for page_key, page_info in PAGES.items():
        check_result = check_page_implementation(page_key)
        status = "✓" if check_result["exists"] else "✗"
        wxml_status = "✓" if check_result["files"].get("wxml") == "exists" else "✗"
        wxss_status = "✓" if check_result["files"].get("wxss") == "exists" else "✗"
        js_status = "✓" if check_result["files"].get("js") == "exists" else "✗"
        json_status = "✓" if check_result["files"].get("json") == "exists" else "✗"
        issues = "; ".join(check_result["issues"]) if check_result["issues"] else "无"
        
        report.append(f"| {page_info['name']} | {status} | {wxml_status} | {wxss_status} | {js_status} | {json_status} | {issues} |\n")
    
    # 2. 云函数检查
    report.append("\n## 2. 云函数检查\n")
    cf_result = check_cloud_functions()
    if cf_result["exists"]:
        report.append(f"共发现 {len(cf_result['functions'])} 个云函数:\n")
        for func in cf_result["functions"]:
            status = "✓" if func["index_js"] and func["package_json"] else "✗"
            report.append(f"- {status} **{func['name']}** (index.js: {'✓' if func['index_js'] else '✗'}, package.json: {'✓' if func['package_json'] else '✗'})\n")
    else:
        report.append("✗ 未找到云函数目录\n")
    
    # 3. 功能检查清单
    report.append("\n## 3. 功能检查清单\n")
    report.append("| 功能项 | 检查内容 | 状态 |\n")
    report.append("|--------|----------|------|\n")
    for func_name, func_desc in FUNCTION_CHECKS:
        report.append(f"| {func_name} | {func_desc} | ⏳ 待测试 |\n")
    
    # 4. 已知问题
    report.append("\n## 4. 已知问题\n")
    report.append("- 登录功能需要配置微信云开发环境\n")
    report.append("- 部分页面 UI 与原型存在差异\n")
    report.append("- 客户选择功能需要修复\n")
    report.append("- 订单详情页面数据加载问题\n")
    report.append("- 智能录入功能待接入 AI 引擎\n")
    
    # 5. 测试建议
    report.append("\n## 5. 测试建议\n")
    report.append("1. 在微信开发者工具中点击\"编译\"\n")
    report.append("2. 右键 cloudfunctions → \"上传并部署：云端安装依赖\"\n")
    report.append("3. 开启服务端口：开发者工具 → 设置 → 安全设置 → 服务端口 → 开启\n")
    report.append("4. 使用 wechat-devtools-automator 进行自动化 UI 测试\n")
    report.append("5. 对比原型 HTML 文件验证 UI 一致性\n")
    
    # 写入报告
    report_path = os.path.join(REPORT_DIR, f"自动化测试报告_{TIMESTAMP}.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("".join(report))
    
    print(f"测试报告已生成：{report_path}")
    return report_path

if __name__ == "__main__":
    generate_report()
