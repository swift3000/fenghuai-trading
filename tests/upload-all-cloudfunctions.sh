#!/bin/bash
# 自动化上传所有云函数脚本

PROJECT_ROOT="/Users/god/Desktop/项目/github/fenghuai-trading"
CLOUDFUNCTIONS_DIR="$PROJECT_ROOT/cloudfunctions"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

echo "=========================================="
echo "  🚀 自动化上传所有云函数"
echo "=========================================="
echo ""

# 检查 CLI 是否存在
if [ ! -f "$CLI" ]; then
    echo "❌ 微信开发者工具 CLI 不存在：$CLI"
    echo "请确保已安装微信开发者工具"
    exit 1
fi

# 检查云函数目录
if [ ! -d "$CLOUDFUNCTIONS_DIR" ]; then
    echo "❌ 云函数目录不存在：$CLOUDFUNCTIONS_DIR"
    exit 1
fi

# 获取云函数列表
echo "📋 发现以下云函数："
FUNCTIONS=()
for dir in "$CLOUDFUNCTIONS_DIR"/*/; do
    if [ -d "$dir" ]; then
        func_name=$(basename "$dir")
        if [ -f "$dir/index.js" ]; then
            FUNCTIONS+=("$func_name")
            echo "   - $func_name"
        fi
    fi
done

echo ""
echo "📊 共发现 ${#FUNCTIONS[@]} 个云函数"
echo ""

# 尝试使用 CLI 上传（注意：CLI 的上传功能可能需要交互式配置）
echo "⚠️  注意：微信开发者工具 CLI 的上传功能通常需要交互式配置"
echo "   建议手动在微信开发者工具中操作："
echo ""
echo "   1. 打开微信开发者工具"
echo "   2. 右键 cloudfunctions 文件夹"
echo "   3. 选择 '上传并部署：云端安装依赖'"
echo ""
echo "   或者逐个右键每个云函数文件夹上传"
echo ""

# 生成操作指南
cat > "$PROJECT_ROOT/云函数上传指南.md" << 'GUIDE'
# ☁️ 云函数上传指南

## 自动化上传（推荐方式）

由于微信开发者工具 CLI 的上传功能需要交互式配置，建议使用以下方式：

### 方式一：批量上传（最快）

1. **打开微信开发者工具**
2. **右键点击** `cloudfunctions` 文件夹
3. **选择** "上传并部署：云端安装依赖"
4. **等待** 所有云函数部署完成（约 2-5 分钟）

### 方式二：逐个上传

如果批量上传失败，可以逐个上传：

1. 右键 `cloudfunctions/auth` → "上传并部署：云端安装依赖"
2. 右键 `cloudfunctions/orders` → "上传并部署：云端安装依赖"
3. 右键 `cloudfunctions/products` → "上传并部署：云端安装依赖"
4. ... 依次上传所有云函数

### 需要上传的云函数列表

- [ ] auth
- [ ] check-customer-fields
- [ ] clear-all-data
- [ ] customers
- [ ] import-data
- [ ] init-db (数据库初始化)
- [ ] orders
- [ ] outbound
- [ ] products
- [ ] receivable
- [ ] regions
- [ ] report
- [ ] smart
- [ ] system
- [ ] users

### 验证上传成功

1. 打开 **云开发控制台**
2. 进入 **云函数** 页面
3. 应该能看到所有 15 个云函数
4. 状态显示为 "部署成功"

### 常见问题

**Q: 上传失败，提示"环境不存在"**
A: 检查 `cloudbaserc.json` 中的环境 ID 是否正确

**Q: 上传失败，提示"依赖安装失败"**
A: 检查网络连接，或手动在云函数目录下运行 `npm install`

**Q: 上传后调用失败**
A: 等待 1-2 分钟让云函数完全部署，然后重试

GUIDE

echo "📄 已生成上传指南：$PROJECT_ROOT/云函数上传指南.md"
echo ""
echo "=========================================="
echo "  ✅ 脚本执行完毕"
echo "=========================================="
echo ""
echo "请按照以下步骤操作："
echo "1. 打开微信开发者工具"
echo "2. 右键 cloudfunctions 文件夹"
echo "3. 选择 '上传并部署：云端安装依赖'"
echo ""

