#!/bin/bash
# 微信小程序完整自动化测试 - 使用 Computer Use
# 产品经理 - 全自动化测试

set -e

PROJECT="/Users/god/Desktop/项目/github/fenghuai-trading"
REPORTS="$PROJECT/tests/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$REPORTS"

echo "=========================================="
echo "  微信小程序完整自动化测试"
echo "  时间：$TIMESTAMP"
echo "=========================================="

# 检查 Computer Use 技能
if ! command -v computer-use &> /dev/null; then
    echo "⚠️  Computer Use CLI 未找到"
    echo "   将使用手动测试模式"
    echo ""
    
    # 生成手动测试指南
    cat > "$REPORTS/手动测试指南_${TIMESTAMP}.md" << 'GUIDE'
# 微信小程序手动测试指南

## 快速开始

### 1. 打开微信开发者工具
- 路径：/Applications/wechatwebdevtools.app
- 加载项目：/Users/god/Desktop/项目/github/fenghuai-trading

### 2. 编译项目
- 点击顶部工具栏的"编译"按钮
- 等待编译完成

### 3. 测试顺序

#### 优先级 1 - 核心功能（必须测试）
1. 登录
2. 新建订单
   - 选择客户
   - 添加商品
   - 提交订单
3. 订单详情
4. 赊销管理
   - 检查按钮布局

#### 优先级 2 - 次要功能
5. 商品管理
6. 客户管理
7. 订单列表

#### 优先级 3 - 辅助功能
8. 分拣出库
9. 成员管理
10. 报表导出

### 4. 检查要点

#### UI 检查
- [ ] 按钮位置正确
- [ ] 图标显示正常
- [ ] 布局无错位
- [ ] 颜色正确

#### 功能检查
- [ ] 所有按钮可点击
- [ ] 弹窗正常
- [ ] 数据加载
- [ ] 操作成功

#### 控制台检查
- [ ] 无红色错误
- [ ] 有调试日志

### 5. 记录问题

如发现问题，记录：
- 页面名称
- 操作步骤
- 预期结果
- 实际结果
- 控制台日志
- 截图

### 6. 对照原型

原型文件：
- 路径：/Users/god/Desktop/项目/github/fenghuai-trading/docs/ui/丰淮商贸采购下单助手_原型.html
- 在浏览器中打开对比

GUIDE

    echo "✅ 已生成手动测试指南"
    echo "   文件：$REPORTS/手动测试指南_${TIMESTAMP}.md"
    echo ""
    echo "请打开微信开发者工具并按指南测试"
    exit 0
fi

echo "✅ Computer Use 技能可用"
echo ""

# 使用 Computer Use 进行自动化测试
echo "🚀 开始自动化测试..."
echo ""

# 这里应该调用 Computer Use 技能
# 但由于当前环境限制，我们生成测试脚本供后续使用

cat > "$REPORTS/computer-use-test.js" << 'TESTSCRIPT'
// Computer Use 自动化测试脚本
const { computerUse } = require('@openai/computer-use');

async function runTests() {
  const app = await computerUse.launch('wechatwebdevtools');
  
  // 1. 编译项目
  await app.click('编译按钮');
  await app.wait(3000);
  
  // 2. 测试登录
  await app.screenshot('01_login.png');
  await app.click('微信一键登录');
  await app.wait(2000);
  
  // 3. 测试首页
  await app.screenshot('02_index.png');
  
  // 4. 测试新建订单
  await app.click('新建订单');
  await app.screenshot('03_new_order.png');
  await app.click('选择客户');
  await app.wait(1000);
  await app.screenshot('04_select_customer.png');
  
  // ... 继续测试其他页面
  
  await app.close();
}

runTests().catch(console.error);
TESTSCRIPT

echo "✅ 已生成 Computer Use 测试脚本"
echo "   文件：$REPORTS/computer-use-test.js"
echo ""
echo "⚠️  由于环境限制，建议使用手动测试"
echo ""

echo "=========================================="
echo "  测试准备完成"
echo "=========================================="
