# Git Commit 建议消息

## 类型
fix: 修复赊销页面布局问题

## 详细描述
修复赊销管理页面的工具栏布局，使收款确认和导出按钮位置符合原型设计

### 变更内容
1. **pages/receivable/receivable.wxml**
   - 调整工具栏结构，添加 `recv-action-row` 容器
   - 收款确认按钮左对齐，导出按钮右对齐

2. **pages/receivable/receivable.wxss**
   - 添加 `.recv-action-row` 样式（flex 布局，左对齐）
   - 添加 `.recv-confirm-btn` 样式（白底绿边按钮）
   - 导出按钮添加 `margin-left: auto` 实现右对齐

### 原型对比
- ✅ 收款确认按钮位置：左上
- ✅ 导出按钮位置：右上
- ✅ 按钮样式符合设计规范

## 测试建议
1. 在微信开发者工具中编译项目
2. 进入赊销管理页面
3. 确认收款确认和导出按钮位置正确
4. 测试按钮功能是否正常

---
