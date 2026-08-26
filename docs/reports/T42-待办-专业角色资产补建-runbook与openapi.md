# T42 fenghuai 专业角色资产补建：runbook + openapi（2026-08-26 产出，来源：v4.15 五新角色落地核查）

## P2-1 建云函数/线上事故 runbook
- 位置：docs/runbook/（目录不存在，需新建）
- 做法：P0-P3 分级、云函数常见故障处置（调用超时/E11000 冲突/日志位置 tcb 命令）、提审回滚步骤（微信版本管理回退）；参考全局 INC 角色流程条款
- 验收：runbook 存在且 P0-P3 各有动作清单；云函数故障 10 分钟内可按册定位
- 状态：待做

## P2-2 建 openapi.yaml
- 位置：docs/api/openapi.yaml
- 做法：基于 docs/API_接口文档.md 整理 OpenAPI 3.0 规格（云函数 action 接口逐个列）；后续新接口同步维护
- 验收：openapi.yaml 可校验通过；与 API_接口文档.md 无接口缺失
- 状态：待做
