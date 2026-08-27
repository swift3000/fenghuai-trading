# T42 fenghuai 专业角色资产补建：runbook + openapi（2026-08-26 产出，来源：v4.15 五新角色落地核查）

## P2-1 建云函数/线上事故 runbook
- 位置：docs/runbook/（目录不存在，需新建）
- 做法：P0-P3 分级、云函数常见故障处置（调用超时/E11000 冲突/日志位置 tcb 命令）、提审回滚步骤（微信版本管理回退）；参考全局 INC 角色流程条款
- 验收：runbook 存在且 P0-P3 各有动作清单；云函数故障 10 分钟内可按册定位
- 状态：已做（docs/runbook/线上事故处置runbook.md：P0-P3 分级 + 6 类故障处置清单 + 云函数/小程序双回滚 + QA 残留应急 + 事后闭环）

## P2-2 建 openapi.yaml
- 位置：docs/api/openapi.yaml
- 做法：基于 docs/API_接口文档.md 整理 OpenAPI 3.0 规格（云函数 action 接口逐个列）；后续新接口同步维护
- 验收：openapi.yaml 可校验通过；与 API_接口文档.md 无接口缺失
- 状态：已做（docs/api/openapi.yaml：31 核心 action + getInviteCode + 权限矩阵 perm-config/save-perm/reset-perm = 35 接口；swagger-cli validate 通过；与 API 文档 action 全量核对无缺失）

## 销项记录
- P2-1: runbook 建成（docs/runbook/线上事故处置runbook.md，89 行；P0-P3 分级 + 6 类故障处置清单 + 云函数/小程序双回滚 + QA 残留应急 + 事后闭环）
- P2-2: openapi.yaml 建成（docs/api/openapi.yaml，OpenAPI 3.0.3，35 接口；swagger-cli validate 通过；与 API 文档 action 全量核对无缺失）；后续新接口须同步维护（APID 门禁）
