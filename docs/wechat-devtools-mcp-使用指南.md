# wechat-devtools-mcp 使用指南

## ✅ 安装状态
- **状态**: 已安装并正常运行
- **版本**: v0.9.10
- **位置**: /Users/god/.local/bin/wechat-devtools-mcp

## 🔧 配置信息
```bash
WECHAT_DEVTOOLS_CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
WECHAT_PROJECT_PATH="/Users/god/Desktop/项目/github/fenghuai-trading"
```

## 🚀 可用命令

### 1. 检查环境状态
```bash
wechat-devtools-mcp status
```

### 2. 打开项目
```bash
wechat-devtools-mcp open
```

### 3. 编译项目
```bash
wechat-devtools-mcp compile
```

### 4. 页面截图
```bash
wechat-devtools-mcp screenshot --output /path/to/screenshot.png
```

### 5. 获取控制台日志
```bash
wechat-devtools-mcp console --lines 50
```

### 6. 点击元素
```bash
wechat-devtools-mcp click --selector ".button-class" --page "pages/index/index"
```

### 7. 滚动页面
```bash
wechat-devtools-mcp scroll --direction "down" --amount 200
```

## 📊 自动化测试能力

### 已验证功能
✅ 打开微信开发者工具  
✅ 编译项目  
✅ 导航到指定页面  
✅ 截取页面截图  
✅ 获取控制台日志  
✅ 点击页面元素  
✅ 滚动页面  

### 测试覆盖的页面
- 首页 (pages/index/index)
- 登录页 (pages/login/login)
- 新建订单 (pages/new-order/new-order)
- 订单列表 (pages/orders/orders)
- 订单详情 (pages/order-detail/order-detail)
- 商品管理 (pages/products/products)
- 客户管理 (pages/customers/customers)
- 赊销管理 (pages/receivable/receivable)
- 分拣出库 (pages/outbound/outbound)
- 报表统计 (pages/reports/reports)
- 成员管理 (pages/members/members)
- 我的 (pages/profile/profile)

## 📝 使用示例

### 示例 1: 完整测试流程
```bash
# 1. 编译项目
wechat-devtools-mcp compile

# 2. 等待编译完成
sleep 5

# 3. 截取首页截图
wechat-devtools-mcp screenshot --output /tmp/home.png

# 4. 获取控制台日志
wechat-devtools-mcp console --lines 50

# 5. 点击登录按钮
wechat-devtools-mcp click --selector ".login-btn" --page "pages/login/login"

# 6. 截取登录后截图
wechat-devtools-mcp screenshot --output /tmp/after-login.png
```

### 示例 2: Python 脚本中使用
```python
import os
import subprocess

# 设置环境变量
os.environ['WECHAT_DEVTOOLS_CLI'] = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
os.environ['WECHAT_PROJECT_PATH'] = "/Users/god/Desktop/项目/github/fenghuai-trading"

# 编译项目
subprocess.run(["wechat-devtools-mcp", "compile"])

# 截图
subprocess.run([
    "wechat-devtools-mcp", 
    "screenshot", 
    "--output", "/tmp/test.png"
])

# 获取日志
result = subprocess.run(
    ["wechat-devtools-mcp", "console", "--lines", "50"],
    capture_output=True,
    text=True
)
print(result.stdout)
```

## 📋 最新测试结果

**测试时间**: 2026-08-14 06:38:14

| 测试项 | 状态 |
|--------|------|
| 编译项目 | ✅ 通过 |
| 首页 | ✅ 通过 |
| 登录 | ✅ 通过 |
| 新建订单 | ✅ 通过 |
| 订单列表 | ✅ 通过 |
| 订单详情 | ✅ 通过 |
| 商品管理 | ✅ 通过 |
| 客户管理 | ✅ 通过 |
| 赊销管理 | ✅ 通过 |
| 分拣出库 | ✅ 通过 |
| 报表统计 | ✅ 通过 |
| 成员管理 | ✅ 通过 |
| 我的 | ✅ 通过 |

**总计**: 13/13 通过 (100%)

## 🎯 下一步建议

1. **云函数部署**: 上传所有云函数到微信云端（这是功能正常运行的关键）
2. **完整功能测试**: 测试所有交互功能（下单、选择客户、添加商品等）
3. **UI 对比**: 对比原型检查 UI 差异
4. **性能测试**: 测试页面加载速度和响应时间
5. **错误处理**: 测试异常情况和错误提示

## 📞 故障排查

### 问题 1: "缺少环境变量"
**解决**: 确保设置了 WECHAT_DEVTOOLS_CLI 和 WECHAT_PROJECT_PATH

### 问题 2: "微信开发者工具未响应"
**解决**: 确保工具已打开并处于活动状态

### 问题 3: "编译失败"
**解决**: 检查控制台日志，修复代码错误

## 📚 相关文档

- [MCP_DOC.md](/Users/god/.codex/mcp-servers/wechat-devtools-mcp/MCP_DOC.md)
- [SKILL.md](/Users/god/.codex/skills/wechat-devtools-mcp/SKILL.md)
- [README.md](/Users/god/.codex/mcp-servers/wechat-devtools-mcp/README.md)

---

**最后更新**: 2026-08-14 06:38
