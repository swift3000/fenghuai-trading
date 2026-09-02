# T60 待办：clear-all-data / init-db / sync-data 补 package-lock.json

状态：待做
来源：T59-R12 DEPAUD（2026-08-31）
P级：P3

## 背景
DEPAUD 依赖纪律要求 lockfile 必入库保证确定性构建。审计发现 3 个云函数缺 package-lock.json（依赖仅 wx-server-sdk ~2.6.3，单依赖，风险低）。

## 步骤
1. 各目录 `npm install --package-lock-only`（或完整 install 后提交 lockfile）
2. 确认 lockfile 与 package.json 一致、无新增依赖
3. 回归 test-all 确认部署不受影响
4. commit + push

## 验收
- 3 目录均有 package-lock.json 且已入库
- test-all 全绿
