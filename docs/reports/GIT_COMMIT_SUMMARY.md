# Git Commit 建议消息

## 类型
fix: 修复赊销页面布局并增强错误日志

## 详细描述
1. 修复赊销管理页面的工具栏布局问题
2. 增强云函数调用的错误日志，便于调试

### 变更内容

#### 1. pages/receivable/receivable.wxml
- 调整工具栏结构，添加 `recv-action-row` 容器
- 收款确认按钮左对齐，导出按钮右对齐

#### 2. pages/receivable/receivable.wxss
- 添加 `.recv-action-row` 样式（flex 布局）
- 添加 `.recv-confirm-btn` 样式（白底绿边）
- 导出按钮右对齐（`margin-left: auto`）

#### 3. utils/request.js
- 添加云函数调用日志（📡 调用云函数）
- 添加成功返回日志（✅ 云函数成功）
- 添加详细错误日志（❌ 云函数调用失败）
- 显示错误详情（JSON 格式化）

### 原型对比
- ✅ 收款确认按钮位置：左上
- ✅ 导出按钮位置：右上
- ✅ 按钮样式符合设计规范

### 调试改进
现在所有云函数调用都会在控制台显示：
```
📡 调用云函数：auth 参数：{action: 'login'}
✅ 云函数成功：auth 返回：{code: 0, data: {...}}
```

或错误信息：
```
❌ 云函数调用失败：auth 错误：{errMsg: "..."}
   错误详情：{...}
```

## 测试建议
1. 在微信开发者工具中编译项目
2. 查看控制台日志确认错误信息
3. 测试赊销页面按钮位置
4. 逐个页面测试云函数调用

## 相关文件
- `pages/receivable/receivable.wxml`
- `pages/receivable/receivable.wxss`
- `utils/request.js`
- `测试与修复指南.md`

---
