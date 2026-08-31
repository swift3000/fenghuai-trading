# T61 待办：wx-server-sdk 平台传递依赖漏洞（form-data/protobufjs/request 等）豁免跟踪

状态：阻塞（待微信平台升级 SDK，非我方可控）
来源：T59-R12 DEPAUD（2026-08-31）
P级：P3（豁免，不阻塞发版）

## 豁免理由（DEPAUD 纪律：高危漏洞写明豁免）
- 全部高危（form-data/protobufjs/request/critical）为 wx-server-sdk ~2.6.3 的传递依赖，版本由微信平台锁定，不可独立升级。
- 云函数源码零直接 require 这些包（rg 证实），无直接利用路径。
- 攻击面：微信小程序云函数无对外 HTTP 端点、无文件上传解析外部不可信输入，传递依赖（多用于 SDK 内部 admin 调用）不可达。

## 跟踪
- 每次 npm audit 复核；微信平台发布 wx-server-sdk 新版本时评估升级 + 全量回归。
