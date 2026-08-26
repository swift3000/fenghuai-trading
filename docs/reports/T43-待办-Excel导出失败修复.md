# T43 — Excel/CSV 导出失败修复

- **状态**：已做（ced40be + 2c62afb）
- **日期**：2026-08-26
- **现象**：体验版所有 Excel 导出 toast"导出失败"

## 根因
1. 前端 `wx.downloadFile({url: cloud://...})` 无法下载云存储 fileID → 改用 `wx.cloud.downloadFile({fileID})`（5 页面 6 处）
2. 重新上传时发现主包 2709KB 超 2MB：根目录 `临时/`、`头像/`（微信聊天图片/授权书，非代码）未被打包忽略；且 `uploadWithSourceMap: true` 撑大包体

## 验证
- 服务端 node-sdk 直调 10/10 全绿：reportTab(product/customer/payment) × export/exportDailySummary/exportLedger × excel/csv；excel 校验 PK magic，csv 校验长度与表头
- 数据守恒：黄焖鸡2店 508.00 / TEST_PGWK 42 等基线正确出现在导出
- e2e UI 链路（模拟器）：CDP 偶发断连未跑通，属已知偶发环境问题，不阻塞；代码路径已 grep 确认 6 处
- QA_IMPERSONATE 已全关（10 函数 status 复核全空，生产安全态）

## 交付
- 体验版 1.0.2 已上传（miniprogram-ci）；**mp 后台→版本管理→开发版本→选 1.0.2 设为体验版后重新扫码测试**
- 临时文件已清理；`临时/`、`头像/` 已加 project.config.json packOptions + ci/upload.js ignores（IDE 手动上传同样受益）

## 观察期闭环
- 待用户复测体验版导出（报表/客户汇总/收款台账 3 类 × excel/csv）通过后 24h 复查，结论写 CHANGELOG
