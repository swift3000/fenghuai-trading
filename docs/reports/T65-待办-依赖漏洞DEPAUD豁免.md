# T65 fenghuai-trading 云函数依赖漏洞 DEPAUD 评估与豁免（2026-09-02，来源：巡检 npm audit）

状态：已做（评估完成，豁免成立；无代码改动）

## 扫描结果（npm audit --omit=dev，16 云函数）
- 根目录 79 个漏洞全在 devDependencies（resvg/sharp/miniprogram-automator 本地构建工具，不部署、不进生产）→ 不处置
- 云函数运行时链每函数 17-18 个：form-data/protobufjs/request/axios/jsonwebtoken/lodash.set/qs/tough-cookie/uuid/xml2js/tcb-admin-node 等

## 豁免裁决（逐类）
| 漏洞包 | 来源 | 暴露面 | 裁决 |
|---|---|---|---|
| xlsx 0.18.5 (high, 原型污染) | 直接依赖（report/orders/receivable 报表导出） | **零**：全仓仅 XLSX.write 写出，无 XLSX.read 解析外部文件（grep 0 命中），漏洞触发路径不可达 | 豁免。0.19+ 已从 npm 停发（最高 0.18.5），升级只能走 SheetJS 私有 CDN tarball=引入供应链风险，不划算 |
| @cloudbase/node-sdk / @cloudbase/database / tcb-admin-node (high) | wx-server-sdk 传递依赖 | 平台官方云 SDK 内部链，版本由微信平台锁定 | 豁免：无法单独升级，等官方发版 |
| request/protobufjs/axios/jsonwebtoken/form-data 等 (crit/high) | wx-server-sdk 传递依赖（request 链） | 同上，平台 SDK 内部调用链 | 豁免：同上 |

## 残余风险提示（登记）
- 云函数运行于平台沙箱，上述传递依赖仅服务平台 SDK 自身调用，无直接网络入口
- 后续若微信云 SDK 升版自动带入修复，复扫即可销项
- 触发重评条件：① 新增 XLSX.read 解析外部文件功能 ② wx-server-sdk 大版本升级 ③ 平台 SDK 发安全通告
