# 丰淮商贸采购下单助手 — 技术规格书（TDD）

> **文档版本**：v4.5（赊销收款管理版：全员下单/改单/删单 + 订单内自定义价格 + 客户上次价格 + 赊销收款管理 + 取消商户收款码）  
> **编写日期**：2026-07-30  
> **状态**：已迭代（同步产品 v4.5）  
> **目标读者**：前端工程师、后端工程师、测试工程师  
> **对应版本**：v4.5（方案A唯一方案，4周交付，技术服务费5,000元）  
> **一致性**：本文档与 ERD/API/PRD/用户手册/《产品评估报告》《业务流程全景》共用版本 v4.5。催收闭环 / 审计日志 / 趋势报表：**MVP 不含，后续作为独立升级模块按需追加**（机制见《小程序 MVP 落地计划与技术架构》§7 升级机制）；后端底座（微信云开发）**已纳入 MVP**。  
> **工期**：**MVP 生产化约 33 人天**（见《工期与工作量评估》MVP 专项）  
> **预算**：5,000元（技术服务费包干，不含小程序注册/认证/云资源等甲方承担的第三方费用）

> 本文档已按 MVP（v1.0，2026-08-05）口径修订；功能清单与范围以《小程序 MVP 落地计划与技术架构》为准。部分早期草案功能（分拣驳回 / 暂存配货 / 14:00 分拣超时自动确认）已确认移出当前 MVP，统一收录于 §6.6 二期规划（当前不触发）；**物流件型（大件/中件/小件，ship_\*）已随出库确认 MVP 实现**；**16:00 出库超时自动定时为二期，但原型保留「⏰模拟16:00通过」手动模拟按钮（simulateAutoConfirm）**。

---

## 1. 引言

### 1.1 文档目的

本文档是「丰淮商贸采购下单助手」微信小程序项目的技术设计文档（Technical Design Document），旨在：

- 对技术架构、模块划分、接口设计、数据模型等做出**明确且可实现**的决策
- 作为开发团队的**统一参考基准**，降低沟通成本
- 为测试、验收提供**可追溯的技术依据**
- 以**极简方案**在3周内完成核心闭环交付

### 1.2 项目概述

本项目为丰淮商贸的采购下单场景提供数字化解决方案，最终技术方案如下：

| 维度 | 最终方案（v4.0） |
|------|----------------|
| 前端 | 微信原生小程序（全员使用） |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） |
| 打印方式 | 小程序蓝牙打印（ESC/POS指令，58mm/80mm便携热敏） |
| Web后台 | ❌ 不做任何Web后台页面（**MVP 亦不做**；文中出现的 Web 后台段落均为早期草案，标注为不适用） |
| 技术服务费 | 5,000元（包干，3周交付） |
| **MVP 工作量** | **约 33 人天**（见《工期与工作量评估》MVP 专项） |
| 甲方首年费用 | 约840元（小程序注册+认证+云开发）；MVP 口径：个体户 ≈269 元 / 公司 ≈539 元 |
| 甲方次年费用 | 约540元/年 |

### 1.3 术语表

| 术语 | 说明 |
|------|------|
| TDD | Technical Design Document，技术设计文档 |
| 云开发 | 微信云开发（CloudBase），Serverless 后端服务 |
| 集合（Collection） | 云开发数据库中的数据存储单元，对应关系型数据库的"表" |
| 文档（Document） | 集合中的单条记录，对应"行"，以 BSON/JSON 格式存储 |
| SKU | Stock Keeping Unit，库存量单位，指商品的最小管理单元 |
| 订单快照 | 下单时将商品数据固化到订单中，防止商品变更影响历史订单 |
| 蓝牙打印 | 通过微信小程序蓝牙 API 连接便携热敏打印机（v1.0 必做） |
| 件价/零价 | 大单位（件）单价 / 小单位（个）单价 |
| 计件模式 | 商品计价模式：case（件+零双轨）/ piece（纯件）/ unit（纯个） |
| 调货商品 | SKU为"93"开头的特殊商品，价格由下单员填写 |
| ESC/POS | 热敏打印机通用指令集，通过字节流控制打印格式 |
| SheetJS | 前端 Excel 导出库（xlsx），纯浏览器端生成 .xlsx 文件 |

---

## 2. 技术架构设计

### 2.1 系统架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户终端层                          │
│        ┌──────────────────────────┐                 │
│        │       微信小程序端        │                 │
│        │      (原生 + Vant)       │                 │
│        └────────────┬─────────────┘                 │
│                     │                               │
│              HTTPS / WX SDK                         │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────┐
│                     ▼                               │
│  ┌─────────────────────────────────────────────┐    │
│  │         微信云开发（CloudBase）                 │    │
│  │                                               │    │
│  │  ┌──────────────┐    ┌──────────────────┐   │    │
│  │  │  10个云函数   │    │  云开发数据库      │   │    │
│  │  │  (Node.js)   │    │  (MongoDB 11集合) │   │    │
│  │  └──────────────┘    └──────────────────┘   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│                    服务端层                          │
└─────────────────────────────────────────────────────┘
```

**架构极简说明**：
- 无自建服务器、无 Docker、无 Nginx 反向代理
- 无任何Web后台页面，全员通过小程序操作
- 所有后端逻辑封装在 10 个云函数内
- 数据库仅 11 个核心集合，无冗余

### 2.2 核心数据流

#### 2.2.1 下单流程（主路径）

```
[小程序]                     [云函数]                  [数据库]
  │  1. 加载商品列表            │                          │
  │──调用 products ─────────►│────查询 products 集合───►│
  │◄──返回商品数据────────────│◄──返回文档列表────────────│
  │                            │                          │
  │  2. 选择商品加入购物车       │                          │
  │  (本地 Storage 缓存)        │                          │
  │                            │                          │
  │  3. 提交订单                │                          │
  │──调用 orders ────────────►│                          │
  │   { items: [...] }         │──4. 校验商品状态────────►│
  │                            │◄──返回商品信息──────────│
  │                            │                          │
  │                            │──5. 生成订单快照────────►│
  │                            │   (固化商品数据)          │
  │                            │                          │
  │                            │──6. 写入 orders/order_items ──►│
  │                            │◄──返回订单 ID───────────│
  │                            │                          │
  │◄──返回订单创建结果─────────│                          │
  │                            │                          │
  │  7. 蓝牙打印小票            │                          │
  │   (ESC/POS 指令 + BLE)     │                          │
```

---

## 3. 技术选型说明

### 3.1 选型矩阵

| 层次 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **小程序框架** | 微信原生 | — | 云开发 SDK 原生集成度最高；无额外编译构建；团队熟悉 |
| **UI 组件库（小程序）** | Vant Weapp | v1.x | 社区成熟；覆盖订单、表单、弹窗场景；样式可定制 |
| **后台框架** | 原生 HTML5 + 原生 JS | — | 零构建、零依赖（除 SheetJS CDN）；单文件可部署；极简到极致 |
| **后台 Excel 导出** | SheetJS (xlsx) | CDN 最新版 | 纯前端浏览器生成 .xlsx；不写云函数；不存云存储；零后端成本 |
| **后台打印** | window.print() + CSS @page | — | 浏览器原生；配合 241mm 针式多联单；零依赖 |
| **后端服务** | 微信云开发 | — | Serverless 免运维；与小程序/云函数/数据库一体化 |
| **云函数运行时** | Node.js | 18.x LTS | 与前端统一语言；云开发官方支持 |
| **数据库** | 云开发数据库（MongoDB） | — | MongoDB 兼容；12 个集合极简建模；与云函数零延迟 |
| **蓝牙打印** | 微信蓝牙 API + ESC/POS | — | wx.openBluetoothAdapter + wx.createBLEConnection；通用 BLE 热敏打印机 |
| **认证** | 微信登录（openid） | — | 小程序端 wx.login 换 openid（**MVP 仅此一条链路**） |
| ~~**Web 后台部署**~~ | — | — | **不适用**：无 Web 后台，MVP 为纯小程序 |

### 3.2 砍掉的技术（极简原则）

| 砍掉项 | 原因 |
|--------|------|
| **Web 后台（整体）** | **MVP 不做任何 Web 后台**，全部能力在小程序内实现 |
| Element Plus / Vue 3 全家桶 | 无 Web 后台，前端仅微信原生小程序 |
| ECharts | MVP 不做趋势图表（趋势报表为独立升级模块），经营分析用 Excel 导出自行透视 |
| ExcelJS | 导出改前端 SheetJS 完成，省掉云函数 CPU 和云存储费用 |
| MobX-miniprogram | 小程序用 wx.setStorage + 页面 data 即可，无需状态管理库 |
| Docker / Nginx / MySQL | 微信云开发 Serverless 一体化，无自建服务器与关系库 |
| 请求签名/HMAC | 云开发天然鉴权（云函数内可拿到 openid），无需额外签名层 |
| 微信支付 | MVP 不开通（赊销记账模式），规避 0.6% 流水手续费 |

### 3.3 ~~Web 后台代码规范（单 HTML 文件）~~（**不适用，已作废**）

> **不适用**：本产品无 Web 后台，MVP 为纯微信原生小程序 + 微信云开发。本小节为 v4.0 之前的早期草案，仅作历史记录保留，**不作为实现依据**。导出（SheetJS）与打印能力均在小程序端实现。

<details>
<summary>展开查看已作废的历史草案</summary>

**单文件结构**：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>丰淮商贸后台</title>
  <!-- 仅引入 SheetJS CDN -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style> /* 内联CSS */ </style>
</head>
<body>
  <nav>标签页导航：订单/商品/客户/区域/用户</nav>
  <section id="page-orders">订单页</section>
  <section id="page-products" style="display:none">商品页</section>
  <!-- ... -->
  <script>
    // 原生 JS：tab切换、云函数调用、表格渲染、SheetJS导出、window.print()
    const app = {
      currentTab: 'orders',
      switchTab(name) { /* ... */ },
      callCloud(fnName, data) { /* wx.cloud.callFunction 或 HTTP API */ },
      renderOrders(list) { /* innerHTML 拼 <table> */ },
      exportExcel(data) { /* XLSX.utils + XLSX.writeFile */ },
      doPrint() { /* window.print() */ }
    };
  </script>
</body>
</html>
```

**规范**：
- 所有逻辑内联在一个 `index.html` 文件中
- 变量/函数：camelCase
- DOM 操作：优先 `querySelector` + `innerHTML` 模板字符串
- 异步：`async/await` + `try/catch`，失败用 `alert()` 提示
- 不引任何其他第三方库（除 SheetJS CDN）

</details>

### 3.4 云函数命名与编写规范

**仅 10 个云函数**（`module-action` kebab-case）：

| 序号 | 云函数名 | 职责 |
|------|----------|------|
| 1 | `auth` | 微信登录换 openid、返回用户信息 |
| 2 | `products` | 商品查询 + 增、改（不做删，软删用 status） |
| 3 | `customers` | 客户查询 + 增、改 |
| 4 | `orders` | 订单查询 + 创建、状态变更、临时改价 |
| 5 | `users` | 用户查询 + 增、改、禁用 |
| 6 | `regions` | 区域查询 + 增、改 |
| 7 | `receivable` | 应收款/赊销查询与统计 |
| 8 | `system` | 系统配置读写（含 AI 服务配置） |
| 9 | `smart` | 智能匹配（商品/客户模糊匹配）、语音转文字 |
| 10 | `report` | 报表统计与导出 |

**编写规范**：
- 入口：`exports.main = async function(event, context) { ... }`
- 初始化：顶部 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`
- 错误处理：所有异步 `try/catch`，统一返回 `{ code, message, data }`
- 模块依赖：CommonJS `require`，不用 ES Module

---

## 4. 数据库设计

### 4.1 集合总览（11 个）

| 序号 | 集合名 | 说明 | 数据量级预估 |
|------|--------|------|-------------|
| 1 | `users` | 系统用户（含角色、wx_openid） | < 1,000 条 |
| 2 | `products` | 商品信息（SKU 主数据） | < 10,000 条 |
| 3 | `customers` | 客户信息（含区域冗余） | < 50,000 条 |
| 4 | `orders` | 订单主表（含商品快照） | > 100 万条 |
| 5 | `order_items` | 订单明细 | > 500 万条 |
| 6 | `regions` | 客户区域（11 个预置 + 可扩展） | < 200 条 |
| 7 | `payments` | 收款记录（登记→库管确认两步，独立集合） | 随收款操作增长 |
| 8 | `product_aliases` | 商品别名（智能录入模糊匹配用） | < 5,000 条 |
| 9 | `customer_aliases` | 客户别名（智能录入模糊匹配用） | < 2,000 条 |
| 10 | `order_logs` | 订单操作记录（订单修改历史） | 随订单操作增长 |
| 11 | `system_config` | 系统配置（AI 服务密钥 + 打印机配置，单文档） | 1 条 |
| 12 | `perm_configs` | 角色权限覆盖（每角色 1 条：role + permissions 完整数组，权限矩阵存储） | 4 条 |

**砍掉的冗余集合**：
- ~~categories~~：分类合并到 products.category 字段（字符串枚举即可，无多级分类需求）
- ~~price_changes~~：改价直接在 order_items 记 original_price + is_price_modified 标记
- ~~account_inheritance_logs~~：直接在 users 表标记 inherited_from，不记独立日志
- ~~operation_logs~~：**MVP 不含**操作审计日志，后续作为独立升级模块按需追加（机制见《小程序 MVP 落地计划与技术架构》§7 升级机制）；MVP 期间依赖云开发平台自带调用日志
- ~~announcements~~：极简版不做系统公告
- ~~backups~~：云开发自带每日备份，无需自建备份表

### 4.2 集合详细设计

#### 4.2.1 `regions` — 客户区域

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `name` | String | ✅ | — | 区域名称（如"汉滨区"） |
| `sort` | Number | ✅ | `0` | 排序值 |
| `status` | String | ✅ | `"active"` | active / inactive |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |

**预置 11 个**：白河县、汉滨区、旬阳市、汉阴县、岚皋县、平利县、石泉县、紫阳县、宁陕县、镇坪县、外县。仅可停用不可删除。

#### 4.2.2 `products` — 商品信息

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `sku_code` | String | ✅ | — | SKU 编码，唯一；93开头为调货商品 |
| `name` | String | ✅ | — | 商品名称 |
| `category` | String | ❌ | `""` | 分类（字符串枚举，如"蔬菜""肉类"，不建独立集合） |
| `unit` | String | ✅ | — | 计量单位，如"斤""箱""个" |
| `pricing_mode` | String | ✅ | `"case"` | case / piece / unit |
| `spec` | String | ✅ | — | 规格，如"1×24" |
| `unit_piece_qty` | Number | ✅ | `1` | 每件零数 |
| `price_piece` | Number | ❌ | `null` | 件价 |
| `price_unit` | Number | ❌ | `null` | 包价/单价（唯一包价字段） |
| `pinyin` | String | ❌ | `""` | 拼音首字母 |
| `status` | String | ✅ | `"active"` | active / disabled |
| `sort` | Number | ❌ | `0` | 排序值 |
| `usage` | Number | ✅ | `0` | 使用频率（下单次数累计）：新建订单成功时订单内每个商品自动 +1（选择越多的越靠前），录单页商品列表按此降序排列 |
| `created_by` | String | ❌ | `null` | 创建人ID |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |

**索引**：
- `{ sku_code: 1 }` 唯一索引
- `{ category: 1, status: 1, sort: 1 }` 分类浏览
- `{ usage: -1 }` 使用频率排序（录单页默认）
- `{ name: "text" }` 名称搜索
- `{ pinyin: 1 }` 拼音搜索

#### 4.2.3 `customers` — 客户信息

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `name` | String | ✅ | — | 客户名称 |
| `alias` | String | ❌ | `""` | 别名/简称 |
| `contact` | String | ❌ | `""` | 联系人 |
| `phone` | String | ❌ | `""` | 联系电话 |
| `address` | String | ❌ | `""` | 收货地址 |
| `region_id` | String | ✅ | — | 所属区域 ID |
| `region_name` | String | ✅ | — | 区域名称（冗余） |
| `total_orders` | Number | ✅ | `0` | 累计订单数 |
| `total_amount` | Number | ✅ | `0` | 累计金额 |
| `last_order_at` | Date | ❌ | `null` | 最近下单时间 |
| `status` | String | ✅ | `"active"` | active / disabled |
| `created_by` | String | ❌ | `null` | 创建人ID |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |

**索引**：`{ name: "text" }`、`{ region_id: 1, status: 1 }`、`{ last_order_at: -1 }`

#### 4.2.4 `users` — 系统用户

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `wx_openid` | String | ❌ | `null` | 微信 OpenID，唯一 |
| ~~`username`~~ | String | ❌ | `""` | ~~Web 后台登录用户名~~ **不适用（无 Web 后台）**，MVP 不使用 |
| ~~`password_hash`~~ | String | ❌ | `""` | ~~密码哈希（bcrypt）~~ **不适用**，MVP 仅微信 openid 登录 |
| `name` | String | ✅ | — | 真实姓名（**销售单模板"制单人"取此字段**） |
| `phone` | String | ❌ | `""` | 手机号（**销售单模板"制单人电话"自动取此字段**） |
| `role` | String | ✅ | `"orderer"` | admin / orderer / sorter / warehouse |
| **`fontScale`** | Number | ❌ | `1` | **【MVP 新增】全局字号缩放比例，取值 0.7–1.3（70%–130%），跨设备持久化** |
| `is_inherited` | Boolean | ✅ | `false` | 是否继承账号 |
| `inherited_from` | String | ❌ | `null` | 继承自哪个用户ID |
| `status` | String | ✅ | `"active"` | active / disabled |
| `last_login_at` | Date | ❌ | `null` | 最后登录 |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |

**索引**：`{ wx_openid: 1 }` 唯一（部分索引）、`{ username: 1 }` 唯一（部分索引）

#### 4.2.5 `orders` — 订单主表

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `order_no` | String | ✅ | — | 丰淮商贸-YYYYMMDD-NNNN |
| `customer_id` | String | ✅ | — | 客户ID |
| `customer_name` | String | ✅ | — | 客户名称（冗余） |
| `customer_region` | String | ✅ | — | 客户区域（冗余） |
| `total_amount` | Number | ✅ | `0` | 总金额（4位小数存储，2位显示） |
| `item_count` | Number | ✅ | `0` | 商品种类数 |
| `total_qty` | Number | ✅ | `0` | 总数量 |
| `status` | String | ✅ | `"draft"` | draft / submitted / sorted / confirmed / completed / cancelled（rejected 保留定义但当前流程不触发，见 §6.6 二期规划） |
| ~~`payment_method`~~ | String | ❌ | — | **v4.3.5 起彻底移除**：订单不再有收款方式字段（cash/transfer/credit 不再使用）；所有订单默认未收款，收款仅由 `payment_status` + `payments` 记录体现 |
| `is_printed` | Boolean | ✅ | `false` | 是否已打印 |
| `printed_at` | Date | ❌ | `null` | 打印时间 |
| `remark` | String | ❌ | `""` | 整单备注 |
| `items_snapshot` | Array | ✅ | — | 订单商品快照 |
| `network_time` | Date | ✅ | `new Date()` | 订单时间（网络） |
| `created_by` | String | ✅ | — | 创建人 user_id |
| `created_by_name` | String | ❌ | `""` | 创建人姓名（冗余） |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |
| `submitted_at` | Date | ❌ | `null` | 提交时间 |
| `checked_at` | Date | ❌ | `null` | 分拣完成时间（待分拣→已分拣 写入；字段名沿用历史命名） |
| `confirmed_at` | Date | ❌ | `null` | 已出库确认时间（已分拣→已出库 写入） |
| `reject_reason` | String | ❌ | `""` | 分拣员驳回原因（**二期规划，当前 MVP 不触发**，见 §6.6） |
| `rejected_by` | String | ❌ | `""` | 驳回人（**二期规划**） |
| `rejected_at` | Date | ❌ | `null` | 驳回时间（**二期规划**） |
| `completed_at` | Date | ❌ | `null` | 完成时间（出库完成时写入） |
| `cancelled_at` | Date | ❌ | `null` | 取消时间 |
| `cancelled_reason` | String | ❌ | `""` | 取消原因 |
| `pick_large` | Number | ❌ | `null` | 配货暂存件数-大件（**二期规划：暂存配货，当前 MVP 不启用**，见 §6.6） |
| `pick_medium` | Number | ❌ | `null` | 配货暂存件数-中件（**二期规划**） |
| `pick_small` | Number | ❌ | `null` | 配货暂存件数-小件（**二期规划**） |
| `ship_large` | Number | ❌ | `null` | 实际发货件数-大件（**MVP已实现：出库确认【确认出库】一步时填写**，见 §4.3.3/§6.5；订单详情/出库列表/报表/出库单展示「物流包裹：大件X · 中件X · 小件X」） |
| `ship_medium` | Number | ❌ | `null` | 实际发货件数-中件（**MVP已实现**） |
| `ship_small` | Number | ❌ | `null` | 实际发货件数-小件（**MVP已实现**） |
| `payment_status` | String | ✅ | `"unpaid"` | 收款状态：unpaid 未收款（默认）/ pending 待确认（已登记待库管确认）/ paid 已收款 |
| `received_amount` | Number | ✅ | `0` | 累计实收金额（多次登记累计，订单剩余欠款 = total_amount - received_amount） |

> **收款状态机（v4.3）**：收款记录独立 `payments` 集合（见 4.2.7），订单 `payment_status` 由收款动作驱动——
> ```jsonc
> {
>   "payment_status": "pending",   // unpaid 未收款 / pending 未结清 / paid 已结清
>   "received_amount": 255.50,     // 累计实收金额（元）
> }
> ```
> 流转：订单默认 `unpaid` → 下单员/分拣员/管理员【登记收款】→ `pending`（未结清，含待库管确认与部分已确认）→ 库管/管理员【确认收款】且**剩余欠款 ≤ 0** → `paid`。统一两步流程（v4.3.5 起无订单级收款方式），支持部分收款多次累计与折价/货损。订单详情 / 送货单按此显示「未收款 / 未结清 / 已收款」。

**状态机（主线：待分拣 → 已分拣 → 已出库 → 已完成；draft/cancelled 为遗留态，当前流程不触发）**：
```
submitted（待分拣）──一键分拣──► sorted（已分拣）──库管一步出库确认──► confirmed（已出库）──► completed（已完成）
```

流转规则：
1. 新建订单即入 `submitted`（待分拣，写入 submitted_at）；**无"保存草稿"环节，`draft` 为遗留定义，当前流程不触发**
2. 分拣（一键）：submitted → sorted（已分拣，写入 checked_at）；分拣员点「全部分拣」/「开始分拣」一键完成，无暂存配货/超时自动（物流件型弹窗已随出库确认 MVP 实现：库管一步确认出库时录入 ship_large/ship_medium/ship_small）
3. 出库（库管一步确认）：sorted → confirmed（已出库，写入 confirmed_at）；库管点「全部确认」/「出库确认」一步完成
4. 完成：confirmed → completed（出库完成，写入 completed_at）
5. `cancelled`（取消）为**遗留定义，当前流程不触发**（无手动取消入口，以原型为准）
6. `rejected`（分拣驳回）状态保留定义但当前 MVP 流程不触发，移入 §6.6 二期规划
```

**索引**：`{ order_no: -1 }` 唯一、`{ status: 1, created_at: -1 }`、`{ customer_id: 1, created_at: -1 }`、`{ created_by: 1, created_at: -1 }`、`{ network_time: -1 }`、`{ customer_region: 1, network_time: -1 }`

#### 4.2.6 `order_items` — 订单明细

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `order_id` | String | ✅ | — | 所属订单 ID |
| `product_id` | String | ✅ | — | 商品 ID |
| `product_sku` | String | ✅ | — | SKU（快照） |
| `product_name` | String | ✅ | — | 名称（快照） |
| `product_spec` | String | ✅ | — | 规格（快照） |
| `pricing_mode` | String | ✅ | — | 计件模式（快照） |
| `unit_piece_qty` | Number | ✅ | — | 每件零数（快照） |
| `piece_qty` | Number | ✅ | `0` | 件数 |
| `package_qty` | Number | ✅ | `0` | 包数 |
| `unit_price_piece` | Number | ✅ | — | 件价（快照，可改价） |
| `unit_price_zero` | Number | ✅ | — | 零价（快照，可改价） |
| `is_price_modified` | Boolean | ✅ | `false` | 是否改价 |
| `original_price_piece` | Number | ❌ | `null` | 原始件价（改价前，替代独立 price_changes 表） |
| `original_price_zero` | Number | ❌ | `null` | 原始零价（改价前） |
| `amount` | Number | ✅ | — | 小计金额 |
| `remark` | String | ❌ | `""` | 单项备注 |
| `snapshot_at` | Date | ✅ | `new Date()` | 快照时间 |

**索引**：`{ order_id: 1 }`、`{ product_id: 1 }`

#### 4.2.7 `payments` — 收款记录（v4.3 登记→库管确认两步，独立集合）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | String | 自动 | — | 云开发自动生成 |
| `order_id` | String | ✅ | — | 所属订单 ID |
| `order_no` | String | ✅ | — | 订单号（冗余） |
| `customer_id` | String | ✅ | — | 客户 ID（余额欠款聚合用） |
| `customer_name` | String | ✅ | — | 客户名称（冗余） |
| `method` | String | ✅ | `cash` | 收款渠道：`cash` 现金 / `wechat` 微信（**v4.3.5 取消"订单级收款方式"后，保留此为收款记录渠道字段，用于台账"现余/微信"拆分**；原 `pay_method`/`approach` 统一为此 `method`，与原型一致） |
| `amount` | Number | ✅ | — | 实收金额（元，到账数） |
| `discount` | Number | ✅ | `0` | 折价/货损金额（元）：应付与实收之差，如应付100元实收90元则折价10元（下单员/分拣员登记时可填） |
| `registered_by` | String | ✅ | — | 登记人 user_id（下单员/分拣员/管理员） |
| `registered_by_name` | String | ✅ | — | 登记人姓名（冗余） |
| `registered_at` | Date | ✅ | `new Date()` | 登记时间（pay_time） |
| `status` | String | ✅ | `"pending"` | pending 待库管确认 / confirmed 已确认收款 |
| `confirmed_by` | String | ❌ | `null` | 确认人 user_id（库管/管理员） |
| `confirmed_by_name` | String | ❌ | `null` | 确认人姓名（冗余） |
| `confirmed_at` | Date | ❌ | `null` | 确认时间 |
| `note` | String | ❌ | `""` | 备注 |

**索引**：`{ order_id: 1 }`、`{ customer_id: 1, status: 1, registered_at: -1 }`（赊销页按客户聚合应收/已收/未结清）

**驱动关系**：登记收款 → 新增 `payments`（status=pending），同步 `orders.payment_status=pending`；库管确认 → `payments.status=confirmed`（写 confirmed_by/confirmed_at），累加 `orders.received_amount` 与折价合计；**订单剩余欠款 = total_amount − received_amount − Σ(已确认记录 discount)，剩余欠款 ≤ 0 时 `payment_status=paid`，否则保持 `pending`（未结清）**。

### 4.3 订单快照结构

随 `orders.items_snapshot` 一并写入，保证原子性：

```jsonc
{
  "items_snapshot": [
    {
      "product_id": "abc123",
      "sku": "VEG-001",
      "name": "有机西红柿",
      "spec": "1×24",
      "pricing_mode": "case",
      "unit_piece_qty": 24,
      "piece_qty": 1,
      "package_qty": 5,
      "unit_price_piece": 120.00,
      "unit_price_zero": 5.00,
      "amount": 145.00,
      "snapshot_at": "2026-07-30T10:30:00.000Z"
    }
  ]
}
```

### 4.4 账号继承（极简实现）

员工离职时管理员操作：
1. `users` 云函数接收 `{ from_user_id, to_user_id }`
2. 批量更新 `orders.created_by`、`customers.created_by`、`products.created_by` 字段
3. 设置原用户 `status=disabled`、`is_inherited=true`、`inherited_from` 空
4. 新用户 `is_inherited=true`、`inherited_from=from_user_id`

---

## 5. 接口设计

### 5.1 云函数总览（10 个）

| 云函数名 | 入参 event 字段 | 返回 data | 权限 |
|----------|----------------|-----------|------|
| **auth** | `{ code }`（wx.login code） | `{ token, user }` | 公开 |
| **products** | `{ action: 'list'/'detail'/'create'/'update', filter?, id?, data? }` | `{ list, pagination }` 或 `{ _id }` | 登录用户按角色过滤；**全员完整视图（价格脱敏与精简视图已取消，v4.3）** |
| **customers** | `{ action: 'list'/'detail'/'create'/'update', filter?, id?, data? }` | `{ list, pagination }` 或 `{ _id }` | 登录用户按角色过滤；**全员完整视图（价格脱敏与精简视图已取消，v4.3）** |
| **orders** | `{ action, id?, data }`<br>`action`: create / update-status / update-remark / copy / modify-price / mark-printed / collect-payment / collect-confirm / receivable（分拣/出库确认经 `update-status` 流转；`confirm`（出库确认）一步完成时一并录入物流件型 `ship_large/ship_medium/ship_small`，**MVP已实现**；`save-pick` 配货暂存移入 §6.6 二期规划） | `{ order_id, order_no }` | 按 action 校验角色；下单/改单/删单/改价放开至 4 角色（v4.3） |
| **users** | `{ action: 'list'/'detail'/'create'/'update'/'disable'/'inherit'/'perm-config'/'save-perm'/'reset-perm', filter?, id?, data?, from_id?, to_id?, role?, permissions? }` | `{ list, pagination }` 或 `{ _id }`；`perm-config` 返回各角色权限数组；`save-perm`/`reset-perm` 返回 `{ role, permissions }` | admin |
| **perm_configs** | 集合（角色权限覆盖，每角色 1 条 `{ role, permissions: string[] }`） | — | admin 读写；auth 登录合并生效 |
| **regions** | `{ action: 'list'/'create'/'update', filter?, id?, data? }` | `{ list }` 或 `{ _id }` | admin |
| **receivable** | `{ filter, page, page_size }` | `{ list, pagination }` | 全员 |
| **system** | `{ action: 'getConfig'/'updateConfig'/'getAiConfig'/'updateAiConfig', key?, value?, aiConfig? }` | `{ config }` | admin |
| **smart** | `{ action: 'match'/'transcribe', text?, audioFileID?, mode? }` | `{ customer, items, unmatched }` / `{ text }` | 全员 |
| **report** | `{ action, filter, page, page_size }` | `{ list, pagination }` / 导出数据 | 按角色 |

> **system 云函数**：负责系统配置读写，其中 `getAiConfig`/`updateAiConfig` 用于管理员配置 AI 服务密钥（阿里语音 ASR + 通义千问 NLP），密钥存 `system_config` 集合，仅管理员可读写。

#### 5.1.1 orders action 规格（简化状态机）

| action | 入参 | 状态校验 | 权限 | 行为 |
|--------|------|----------|------|------|
| `confirm`（出库确认，库管） | `{ id }` | 仅限 `sorted`（已分拣） | warehouse/admin | 一步「已分拣 → 已出库」（写入 `confirmed_at`）；不在白名单态返回错误码 `3002` |
| `collect-payment`（收款登记，v4.3） | `{ id, data: { method, amount, discount, time } }` | 任意非取消状态（draft 除外，需先提交）；支持多次部分收款 | orderer/sorter/admin（= `receivable:collect`） | 新增 `payments` 记录（status=pending，registered_by/registered_at），同步 `orders.payment_status=pending`；`discount` 为折价/货损金额（如应付100元实收90元，折价10元，可填） |
| `collect-confirm`（确认收款，v4.3新增） | `{ id, payment_id }` | `payments.status == pending` | warehouse/admin（= `receivable:confirm`） | 确认收款：`payments.status → confirmed`（写入 confirmed_by/confirmed_at），累加 `orders.received_amount`，`orders.payment_status=paid`（全部还清时） |
| `receivable`（赊销，v4.3新增） | `{ filter, page, page_size }` | 无 | 全员 | 三栏口径：按客户聚合 **应收总额 / 已收 / 未结清**（金额守恒：应收 = 已收 + 未结清）；支持客户台账/未结清/已结清三栏与周期导出 |
| `update-remark`（改备注） | `{ id, data: { remark } }` | 任意状态 | 全员（v4.3） | 覆盖 `orders.remark`，任意角色可修改 |
| `update-status`（状态流转） | `{ id, to_status }` | `submitted → sorted`（分拣）<br>`sorted → confirmed`（出库确认）<br>`confirmed → completed`（完成） | sorter/admin（分拣）；warehouse/admin（出库确认/完成） | 分拣完成写入 `checked_at`；出库确认写入 `confirmed_at`；**无"取消/草稿"流转（cancelled/draft 为遗留态，当前流程不触发，以原型为准）** |

> **提交二次确认文案**（下单员提交订单时弹窗，不含订单号与金额）：
> 「（区域-店名）的订单 数量与订单数量确认无误？」
> 例：汉滨区-XX餐厅的订单 数量与订单数量确认无误？
>
> **订单转发（收款码卡片）已取消（v4.3）**：原「📤 转发给客户」收款卡片（含商户收款码 / 央行259号文合规内容）整体下线，无 `shared_at` 扩展点。客户付款核对改为内部赊销对账：下单员/分拣员登记收款 → 库管确认收款。
>
> **转发客户微信（v4.3.2 新增，与上面取消的收款码卡片是两回事）**：仅转发**订单明细**给客户微信好友供核对，**不绑定任何第三方支付/收款码**。订单新增扩展字段 `shared_to_wechat`(Boolean，默认 false)、`shared_at`(DateTime)；前端新建订单提交后自动弹层、订单详情页【转发客户微信】按钮均可触发，点【发送给客户微信】→ 写 `shared_to_wechat=true` + `shared_at`，实际转发由小程序 `onShareAppMessage` / 微信开放标签完成（原型以弹层模拟）。
>
> **订单内自定义价格（v4.3）**：创建/修改订单时，任意商品可传自定义单价（创建时 `tmp_unit_price_piece`/`tmp_unit_price_zero`，改单用 `modify-price`），**仅当前订单生效**；写入快照 `is_price_modified=true` + `original_price_*`（改价前商品默认价）。不限原「93/可调价」档位，全商品可改。
>
> **客户上次价格（v4.3）**：创建订单未传单价时，云函数默认取该客户**最近一笔订单**（`orders.network_time` 最近、非 cancelled）对应商品的成交单价；该客户无历史订单时回退商品默认价（`products.price_piece/price_unit`）。

### 5.2 统一响应格式

```jsonc
{
  "code": 0,          // 0成功；非0错误码
  "message": "ok",
  "data": { ... },
  "timestamp": 1785340800000
}
```

### 5.3 错误码规范（极简版）

| 范围 | 错误码 | 说明 |
|------|--------|------|
| 0 | 0 | 成功 |
| 1xxxx | 1001 | 参数校验失败 |
| | 1002 | 资源不存在 |
| | 1003 | 资源已存在 |
| 2xxxx | 2001 | 未登录 |
| | 2002 | 无权限 |
| | 2003 | 账户已禁用 |
| 3xxxx | 3002 | 订单状态不允许此操作 |
| 5xxxx | 5001 | 服务器内部错误 |

### 5.4 通用查询规范（products/customers/orders/users/regions/receivable）

**请求**：
```jsonc
{
  "type": "orders",
  "filter": {
    "status": "submitted",
    "network_time_gte": "2026-07-01",
    "network_time_lte": "2026-07-30"
  },
  "page": 1,
  "page_size": 20,
  "sort": { "network_time": -1 }
}
```

**单条详情**：`filter: { _id: "xxx" }`，返回 `data` 为单个对象（非 list）。

**角色过滤**：云函数内部自动注入——
- orderer/sorter/warehouse：orders 可看全部（**取消本人/精简视图限制，v4.3**），customers/products/payments 全部可见
- admin：全部权限
- **全员完整视图（v4.3）**：不再做价格脱敏与精简视图，`unit_price_piece`/`unit_price_zero`/`amount`/`total_amount` 全员返回完整值。

**订单列表分栏展示（v4.3）**：前端按 `network_time` 切分——**当日订单**按客户分组、每组完整卡片（商品明细+金额+操作）；**昨天及更早**折叠为单行（客户/订单号/金额/状态摘要），可点击展开，减少滚动干扰。

**物流包裹展示（需求#12，MVP已实现）**：`ship_large`/`ship_medium`/`ship_small`（物流包裹件数）为**MVP已实现**字段——库管一步【确认出库】时录入，所有角色（orderer/sorter/warehouse/admin）可见：
- **库管工作台「已出库」列表卡片**：`confirmed`/`completed` 订单显示「物流包裹：大件X · 中件X · 小件X」
- **订单详情弹窗 / 订单详情页**：展示「物流包裹信息」行（大件X · 中件X · 小件X）
- **未出库订单**（`draft`/`submitted`/`sorted`/`cancelled` 等）：物流包裹为空（不展示该行）或显示 0

**商品列表默认排序**：下单弹窗传 `customer` 上下文时，`products` 按「客户维度常购次数」优先（该客户历史订单商品购买量降序），其次按 `{ usage: -1 }` 全局使用频率降序排序；未传 `customer` 上下文（如新客户选品）时按 `{ usage: -1, sort: 1 }` 全局使用频率排序。录单页商品列表按此展示。

**录单页单栏布局（v4.3）**：录单页改为**单栏布局**——上方为「请选择客户」与「收款方式」，中间为订单明细（商品件包数量、金额），底部为「+ 添加商品」按钮；点击后打开选品弹窗，弹窗内默认展示 3-4 行常购/高频商品，搜索框输入后展示全部匹配商品，点击商品即加入订单明细。选品弹窗商品单价显示**客户上次成交价**（云函数 create 未传价时自动取值，见 5.1.1 客户上次价格），可再行订单内改价。

---

## 6. 关键模块实现方案

### 6.1 数据快照机制

订单创建在 `orders` 云函数 `action=create` 中一次性完成：
1. 校验 `customer_id` 有效性
2. 遍历 items → 查询 `products` → 构建快照；**单价取值优先级（v4.3）**：请求显式单价（自定义价）→ 客户最近订单成交价 → 商品默认价；采用自定义价时写 `is_price_modified=true` + `original_price_*`
3. 计算总金额
4. **【MVP】0 元订单拦截**：若 `total_amount === 0`，**立即中止并返回错误 `ORDER_ZERO_AMOUNT`，不生成订单**（`create` 与 `update` 两个 action 均校验）
5. 生成订单号 `丰淮商贸-YYYYMMDD-NNNN`（当日倒序查最大号+1）
6. 写入 `orders`（含 items_snapshot，`payment_status=unpaid`、`received_amount=0`）和 `order_items`
7. 订单内每个商品 `products.usage` +1（动态累计，供商品选择弹窗排序）
8. 任一环节失败，整体返回错误

### 6.1A 【MVP】0 元订单与 0件0个 过滤

**写入侧（拦截）**：
```javascript
// orders: action = create | update
const total = items.reduce((s, it) => s + it.amount, 0);
if (total === 0) {
  return { code: 'ORDER_ZERO_AMOUNT', msg: '订单金额为 0，无法提交' };
}
```
- 前端在提交按钮上同步做禁用态与 Toast 提示，云函数为最终防线（双层校验）。

**读取侧（过滤）**：
```javascript
// orders: type = orders
where.total_amount = _.gt(0);          // 0 元订单不计入任何列表/统计
// 明细渲染时过滤 0件+0个 行
const visibleItems = order.items_snapshot.filter(
  it => !(it.piece_qty === 0 && it.package_qty === 0)
);
```
- 过滤规则对**订单列表、订单详情、赊销页（客户台账/未结清/已结清）、报表汇总、打印/转发销售单**一致生效。
- **排序统一**：订单列表、赊销客户列表、客户内部订单均按 `{ network_time: -1 }` **时间降序**。

### 6.1B 【MVP】销售单模板（西安迈尚版）

由 `print` 云函数 / 小程序端模板组件 `salesTemplate` 统一渲染，**打印（蓝牙 ESC/POS）与微信转发共用同一模板**：

| 要素 | 规则 |
|------|------|
| 抬头 | 固定「**西安迈尚食品销售单**」 |
| 单号 | **去掉 "NO." 前缀**，直接输出 `order_no` |
| 制单人 | 自动取当前登录人 `users.name` |
| 制单人电话 | 自动取当前登录人 `users.phone`（**不再手工填写**） |
| 表格列 | 商品名称 / 规格 / 数量 / 单价 / 金额 / **备注（独立列，金额列之后）** |
| 备注来源 | 逐行取 `items_snapshot[].remark`，与商品名分列显示 |
| 行过滤 | 0件+0个 商品行不输出（见 6.1A） |

### 6.1C 【MVP】全局字号缩放（适老化）

```javascript
// utils/fontScale.js
const MIN = 0.7, MAX = 1.3, STEP = 0.1;   // 70% ~ 130%

function applyScale(scale) {
  const s = Math.min(MAX, Math.max(MIN, scale));
  wx.setStorageSync('fontScale', s);       // 本地即时生效
  getApp().globalData.fontScale = s;       // 驱动 CSS 变量 --font-scale
  return s;
}

// 变更后异步落库，跨设备持久化
async function persist(scale) {
  await wx.cloud.callFunction({
    name: 'auth', data: { action: 'set-font-scale', fontScale: scale }
  });
}
```
- **入口**：① 状态栏「字」按钮（全局组件 `fontZoomPanel`，任意页面可唤起）；② 「我的」页 → 字号设置。
- **实现**：`app.wxss` 定义 `--font-scale`，各页面字号以 `calc(28rpx * var(--font-scale))` 形式书写，切换即时全局生效。
- **持久化**：`wx.setStorageSync` 本地兜底 + `users.fontScale` 云端落库；登录后以云端值为准回写本地。
- **兼容性要求**：70%–130% 全区间内页面不得溢出/错行（见 PRD §5.4）。

### 6.2 Excel 导出（前端 SheetJS，不写云函数）

**实现代码（小程序端）**：

```javascript
async function exportOrders(filter) {
  // 1. 调用 orders 拉取全部数据（page_size=10000）
  const res = await callCloud('orders', {
    type: 'orders',
    filter,
    page: 1,
    page_size: 10000,
    sort: { network_time: -1 }
  });
  if (res.code !== 0) return alert(res.message);

  // 2. 平铺订单+明细为行数据
  const rows = [];
  for (const order of res.data.list) {
    for (const item of order.items_snapshot) {
      rows.push({
        订单号: order.order_no,
        下单时间: formatDate(order.network_time),
        客户: order.customer_name,
        区域: order.customer_region,
        商品: item.name,
        规格: item.spec,
        SKU: item.sku,
        件数: item.piece_qty,
        包数: item.package_qty,
        件价: item.unit_price_piece,
        零价: item.unit_price_zero,
        小计: item.amount,
        订单总金额: order.total_amount,
        发货大件: order.ship_large ?? 0,
        发货中件: order.ship_medium ?? 0,
        发货小件: order.ship_small ?? 0,
        状态: STATUS_MAP[order.status],
        经办人: order.created_by_name,
        备注: order.remark
      });
    }
  }

  // 3. SheetJS 生成 xlsx 并下载
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    {wch:18},{wch:16},{wch:16},{wch:8},{wch:18},{wch:8},
    {wch:12},{wch:6},{wch:6},{wch:8},{wch:8},{wch:10},
    {wch:10},{wch:8},{wch:10},{wch:8},{wch:8},{wch:8},{wch:20}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单明细');
  XLSX.writeFile(wb, `订单导出_${formatDate(new Date())}.xlsx`);
}
```

**说明**：无云函数 CPU 开销、无云存储费用、无临时链接过期问题。大数据量（> 2000 条）时建议用户缩小日期范围。

**导出规格补充（需求#12，物流包裹列，MVP已实现）**：
> 物流包裹（件型）展示与导出 **MVP已实现**：库管一步【确认出库】时录入 `ship_large`/`ship_medium`/`ship_small`，订单详情/出库列表/报表/出库单均展示「物流包裹：大件X · 中件X · 小件X」（`ship_*` 为 MVP 已写入字段）。以下列定义即当前启用口径：
- **主报表**（本小节订单导出）：订单级新增「发货大件 / 发货中件 / 发货小件」3 列（取值 `orders.ship_large`/`ship_medium`/`ship_small`，未出库订单为 0）；同一订单含多条明细时，各明细行重复该订单级 3 列值
- **出库单导出**：同样新增「发货大件 / 发货中件 / 发货小件」3 列（订单级）
- **单订单导出**：在信息区一行展示「物流包裹：大件X · 中件X · 小件X」（订单级一行，不新增列）
- **客户汇总台账（外县1:1）**：**保持现状不动**，不新增物流包裹列

### 6.3 送货单（订单明细）打印模板规格

> v4.0 起无 Web 后台，送货单/订单明细由**小程序端**渲染打印（蓝牙热敏 58mm/80mm 或系统打印），打印后调 `orders` 的 `mark-printed` 标记已打印。

**列结构（共 4 列，无"规格"列）**：

| 商品名称 | 数量（件+包合并 1 行） | 单价 | 金额 |
|----------|------------------------|------|------|

**模板规格（需求变更 v2.1）**：
1. **同商品件+包合并 1 行**：`piece_qty>0 且 package_qty>0` → 「N件M包」；仅件 → 「N件」；仅包 → 「M包」（单位统一为"包"）
2. **去掉"规格"列**：`spec` 不再打印
3. **数量列字体放大**：数量字号 ≥ 单价/金额字号的 1.5 倍并加粗
4. 订单号统一「丰淮商贸-YYYYMMDD-NNNN」
5. **不打印收款状态 / 收款方式（按客户指定格式）**：送货单按「西安迈尚食品销售单」模板原样打印客户信息 + 商品明细 + 合计 + 累计欠款 + 制单人 + 签收栏，**不叠加收款状态 / 三方追溯 / 分拣备注 / 物流件型**（客户端指定格式，详见 PRD §4.3.5）
6. **不含商户收款码（v4.3 已下线）**：送货单不再印制任何收款码/经营码，无央行259号文合规内容
7. 打印完成后 `mark-printed` 标记已打印

**CSS（打印预览）**：
```css
@media print {
  @page {
    size: 241mm 140mm;   /* 横版针式多联单 */
    margin: 5mm;
  }
  .no-print { display: none !important; }
  body { font-family: SimSun, "宋体", monospace; font-size: 10pt; }
  table.print-table { width: 100%; border-collapse: collapse; }
  table.print-table th,
  table.print-table td { border: 1px solid #000; padding: 2px 4px; }
  td.qty { font-size: 15pt; font-weight: bold; }  /* 数量列字体放大（默认 10pt 的 1.5 倍） */
}
```

**流程**：
1. 订单列表/详情 → 点"打印送货单"
2. 小程序端按模板渲染打印预览 DOM
3. 蓝牙热敏打印（58mm）或系统打印（A4/针式），1-3 份
4. 调 `orders` 的 `mark-printed` 标记已打印

### 6.4 蓝牙打印方案（小程序端 BLE + ESC/POS）

详见第 8 章「蓝牙打印技术详解」。

### 6.5 赊销收款管理（v4.3，替代原「订单转发给客户」）

> 原「订单转发给客户（订单收款卡片 + 商户收款码，需求#11）」**v4.3 整体取消**（商户收款码 / 央行259号文合规内容下线）。收款改为**内部赊销对账**，两步动作：

**① 收款登记（下单员/分拣员/管理员，v4.3.6 库管无登记权限）**：订单详情/列表或赊销页点【收款】（v4.3.4 统一按钮，自动分流为登记）→ 填写**收款方式（现金/微信，台账"现余/微信"拆分用）**、**实收金额**、**折价/货损金额（可选）**、备注 → 保存 → 新增 `payments` 记录（status=pending，method=现金/微信，registered_by=登记人），`orders.payment_status → pending`，同时该笔收款**下推库管**待确认队列（赊销页按钮显示「·N 待确认」）。**库管角色被禁止登记收款：点【收款】不会进入登记弹窗；若强行提交 `submitCollect` 会被拦截并返回提示「库管仅负责确认收款，不能登记收款」。**

**② 确认收款（库管/管理员）**：赊销页客户卡片或订单详情点【收款】→ 若有 pending 收款则直接打开【确认收款】列表逐笔【确认】→ 对应 `payments.status → confirmed`（confirmed_by/confirmed_at 写入），`orders.received_amount` 累加实收；**订单剩余欠款 = total_amount − received_amount − Σ(已确认 discount) ≤ 0 时 `payment_status → paid`，否则保持 `pending`（未结清）**。**库管无 pending 时【收款】提示「暂无待确认收款，请等待下单员/分拣员登记」，不进入登记弹窗（v4.3.6 库管仅确认、不登记）。**

**赊销页（`receivable`，全角色可见，三栏重设计 + 金额守恒）**：
- **三栏 Tab**：📋 客户台账 / 📌 未结清 / ✅ 已结清，外加独立「✅ 收款确认」按钮
- **客户台账（以客户为单位的总账）**：每张客户卡片显示 **应收总额 / 已收 / 未结清**（金额守恒：应收 = 已收 + 未结清）；卡头含客户名 + 区域 + 状态标签（未结清 / 部分结清·待确认 / 已结清）
- **未结清栏**：列出该客户未结清订单（剩余欠款 > 0），含每笔应收/已收/未结清与账期（最长欠款天数色点：≤30天绿、1-2月黄、2-3月橙、3月+红）
- **已结清栏**：列出该客户已结清订单（`payment_status='paid'`，含 confirmed 收款），显示 实收/确认人/确认日
- **已收口径**：用「已收」(received，含部分收款/折价) 替代原「已结清」（仅完全结清）；台账 / 汇总 / 导出三处统一
- **收款两步**：① 登记收款（`receivable:collect`，下单员/分拣员可、库管不可）→ 订单 `payment_status → pending`；② 确认收款（`receivable:confirm`，库管可、下单员/分拣员不可）→ `payments.status → confirmed`，累加 `received_amount`，剩余欠款 ≤ 0 时 `paid`
- **收款确认视图（库管确认工作台）**：上半区「待库管确认」仅列 `pendingCount(o) > 0` 的订单按最早 pending 登记时间升序，每笔显示 `amount/discount/registered_by_name/remark`，库管/管理员逐笔【确认】；下半区「已结清」灰显 `payment_status='paid'` 订单（显示 `received_amount`/`confirmed_by`/确认日）。搜索/账期筛选同样生效
- **导出报表**：支持周期选择（全部/今日/本周/本月/自定义），明细行订单号含时间故不重复显示时间列，汇总行显示 应收/已收/未结清
- **筛选**：顶部**搜索框**（客户名/区域实时筛选）+ **账期快捷筛选**（全部 / 30天内 / 1-2月 / 2-3月 / 3月+，按最长欠款天数过滤）；欠款为 0 的客户可隐藏

**订单收款状态机**：`unpaid` 未收款（默认）→ 登记 → `pending` 待确认 → 库管确认 → `paid` 已收款；支持部分收款多次累计。

**全端收款码下线验收**：订单页/送货单/导出/任何卡片均无商户收款码、经营码、259号文内容。

### 6.6 二期规划（当前 MVP 已取消，不触发，留作后续升级）

> 以下功能在 v4.5 简化原型中已从主流程移除或本次随原型落地调整，统一收录于此，供后续独立升级模块按需追加（机制见《小程序 MVP 落地计划与技术架构》§7 升级机制）。**物流件型（ship_\*）已随出库确认 MVP 实现（`ship_*` 为 MVP 已写入字段）；暂存配货（pick_\*）、驳回（reject_\*）、14:00 分拣超时自动仍为二期/遗留，对应字段在 `orders` 集合中保留定义但当前不写入。**

**① 分拣驳回（rejected）**：分拣员可对 `submitted` 订单执行驳回（必填 `reject_reason`，订单红色醒目），状态 `submitted → rejected`；下单员修改后重提为新 `submitted` 订单。`rejected` 状态保留字段定义（`reject_reason`/`rejected_by`/`rejected_at`），但当前流程不触发。

**② 暂存配货（pick_\*）**：库管对 `submitted`/`sorted` 订单暂存配货件数 `pick_large`/`pick_medium`/`pick_small`，**不改变订单状态**；原 `save-pick` action 取消（**二期规划**）。

**③ 物流件型弹窗（ship_\*，MVP已实现）**：出库确认（【确认出库】一步）时录入实际发货件数 `ship_large`/`ship_medium`/`ship_small`（物流包裹件型），订单详情/出库列表/报表/出库单均展示「物流包裹：大件X · 中件X · 小件X」；**已从二期规划移出，随出库确认 MVP 实现（`ship_*` 为 MVP 已写入字段）**。

**④ 超时自动确认（SLA）**：
- 14:00 分拣超时自动确认发货（`submitted → sorted`，`auto_sorted=true`）：**保持二期，无对应模拟按钮**；
- 16:00 库管超时自动出库（作用于 `submitted` + `sorted` 订单 → `confirmed`，`auto_confirmed=true`）：**自动定时为二期，但原型保留「⏰模拟16:00通过」手动模拟按钮（simulateAutoConfirm），点击把当日待出库订单置为已出库**；日常出库仍由人工一步确认。

### 6.7 智能录入技术方案

- **前端解析引擎**：
  - 文字解析：正则表达式 + 关键词提取，从自然语言中识别商品名称、数量（件/包）、客户名称
  - 语音识别（ASR）：生产化阶段对接阿里云智能语音（免费额度 1000 分钟/月），wx.getRecorderManager 录音 → 云函数转调 ASR API
  - 自然语言理解（NLP）：生产化阶段可选对接通义千问 Qwen-Turbo/Plus（免费 200 万 Tokens/月），用于复杂语义理解
- **匹配算法**：
  - 精确匹配：商品名称/料号完全一致
  - 模糊匹配：Levenshtein 距离算法，阈值 0.6（允许简称/缩写匹配）
  - 别名匹配：支持商品别名库（`product_aliases`）和客户别名库（`customer_aliases`）
  - 拼音匹配：拼音首字母搜索
  - 包含匹配：输入文本包含库中名称或反之
  - 智能记忆优先：`productLastUsed` / `customerLastUsed` 缓存，相同输入自动复用上次选择
- **数据流**：
  ```
  用户输入（文字/语音）→ 前端预解析（正则提取候选词）→ 云函数 smart.match
  → 查 products/customers 集合模糊匹配 → 返回匹配结果列表
  → 多结果时前端弹选择列表 → 用户选择 → 记忆写入 localStorage
  → 生成订单草稿 → 确认跳转新建订单页
  ```
- **规则引擎 + LLM 混合方案**（生产化阶段）：
  - 第一层：规则引擎（正则+模糊匹配），覆盖 80% 常见场景，响应 <100ms
  - 第二层：LLM 兜底（规则引擎未命中时调用），处理口语化/复杂表达，准确率 92-95%
  - 成本：前期 0 元（纯规则引擎），后期约 80 元/月（ASR + LLM 超出免费额度部分）
- **smart 云函数对接 AI**：
  - `smart.transcribe` 语音转文字对接阿里云智能语音（ISI），需从 `system_config` 集合读取阿里语音配置（AccessKeyId / AccessKeySecret / AppKey / 地域 / 模型），未配置时降级返回空
  - `smart.match` 复杂语义理解可选对接通义千问（DashScope），需从 `system_config` 集合读取千问配置（API Key / 模型），未配置时降级为纯规则引擎
  - 密钥统一从 `system_config` 集合读取（由 `system` 云函数 `getAiConfig` 提供），**不写死在前端**，仅管理员可配置

---

## 7. 安全与部署

### 7.1 安全设计（极简版）

#### 认证
- **小程序端**：`wx.login()` → `auth` 云函数换 `openid` → 匹配 `users.wx_openid` → 返回用户信息。无 JWT，云函数内部通过 `cloud.getWXContext().OPENID` 即可拿到身份（云开发天然安全）。
- **首管理员（方案 A 零配置）**：`auth` 在系统无任何 `role=admin` 用户时，自动将第一位登录者赋值为 `admin`；老板部署后直接用微信打开小程序登录即可，无需预置 openid 或配置任何环境变量（手动插库创建 admin 仅作可选兜底方式二）。
- ~~**Web 后台端**~~：**不适用**（无 Web 后台）。MVP 仅保留微信 openid 一条认证链路，`users.username` / `password_hash` 字段不启用。

#### 权限（RBAC 四角色）

| 角色 | 范围 |
|------|------|
| admin | 全部 10 个云函数全部 action |
| orderer | auth、products/customers/orders/users/regions/receivable（全部订单+商品客户+payments）、orders（create/update-status（取消）/update-remark/copy/modify-price/mark-printed/collect-payment/receivable）、订单详情/列表【登记收款】 |
| warehouse | products/customers/orders/users/regions/receivable（全部订单、**完整视图含价格**）、orders（create/update-status：sorted→confirmed 出库确认（= `warehouse:confirm`）/取消、update-remark/copy/modify-price/mark-printed/collect-confirm（确认收款，= `receivable:confirm`）/receivable）、**全员下单/改单/删单（v4.3）** |
| sorter | products/customers/orders/users/regions/receivable（全部订单、完整视图）、orders（update-status: submitted→sorted 分拣（一键，= `sort:task`）；create/取消/改价等同下订单权限）、collect-payment（登记收款，= `receivable:collect`）/receivable、mark-printed |

> **全员订单权限（v4.3）**：4 角色均可新建、修改、删除订单与订单内自定义价格；**取消分拣员只读与库管价格脱敏**，全员查看完整价格视图。
> **【MVP】商品/客户全角色 CRUD**：`products` 与 `customers` 的增删改 action 对 **admin / orderer / sorter / warehouse 四角色全部放开**，不再限于 orderer + admin；上表中 warehouse、sorter 行的权限范围据此扩展。
> **收款两步（v4.3）**：下单员/分拣员【登记收款】（collect-payment = `receivable:collect`，可填折价/货损）→ 库管【确认收款】（collect-confirm = `receivable:confirm`）；管理员兼有两者；warehouse 无登记权限、sorter 无确认权限。
> **细粒度权限标识（v4.5）**：`sort:task`（处理分拣）由 sorter 拥有，控制「待分拣→已分拣」；`warehouse:confirm`（出库确认）由 warehouse 拥有，控制「已分拣→已出库」；两者默认全员开放，管理员可在「成员管理 → 权限配置」开关。`receivable:collect`（登记收款）下单员/分拣员可、库管不可；`receivable:confirm`（确认收款）库管可、下单员/分拣员不可。
> **物流包裹展示权限（需求#12，MVP已实现）**：物流包裹件数（`ship_large`/`ship_medium`/`ship_small`）非脱敏字段，**已随出库确认 MVP 实现**——库管一步【确认出库】时录入；已出库（`confirmed`/`completed`）订单在库管工作台「已出库」列表卡片、订单详情弹窗与订单详情页对所有角色（orderer/sorter/warehouse/admin）可见；未出库订单物流包裹为空/0。
> **备注修改权限（v4.3）**：任意角色可随时修改订单备注（`orders.remark`，`update-remark`），任意订单状态均可。
> **赊销页（v4.5 三栏重设计）**：底部 Tab「赊销」全角色可见，三栏 📋客户台账 / 📌未结清 / ✅已结清 + 独立「✅ 收款确认」按钮；以客户为单位展示 **应收总额 / 已收 / 未结清**（金额守恒：应收 = 已收 + 未结清），用「已收」替代旧「已结清」口径。
>
> **底部 5 个 Tab（v4.5 规范，符合微信 tabBar 上限）**：📋首页 / 📦订单 / 💰赊销 / 🔍分拣出库 / 👤我的。原「分拣」「库管」两个 Tab 已合并为「分拣出库」一个 Tab；全角色可见同一套 5 个 Tab，若某角色被管理员关闭 `receivable:view` / `sort:task` / `warehouse:confirm` 等查看/操作权限，对应 Tab 运行时自动隐藏。「分拣出库」页内含两段切换：① 分拣段（待分拣/已分拣）；② 出库段（待出库/已出库）。报表入口在「我的 → 报表统计」。

> **极简权限校验**：云函数入口处统一 checkRole 中间件（管理员 `member:manage` 判定）。**细粒度权限（1.0）**：在角色校验之上提供可开关权限键，解除"不做细粒度标识"的限制——前端按 `users.permissions`（默认 ∪ `perm_configs` 覆盖）动态隐藏 Tab/按钮，管理员可在「成员管理 → 权限配置」矩阵逐项开关（`users.perm-config` / `users.save-perm` / `users.reset-perm`，详见 §7.4 API 文档）。

#### 其他安全
- **传输加密**：云开发默认 HTTPS
- **密码**：MVP 不设置密码（微信原生 openid 即身份）。若未来开放 Web 后台再评估 bcrypt
- **输入校验**：云函数入口手写 `if/else` 校验必填字段与类型（不引 Joi/Zod 包，省体积）
- **输出过滤**：API 不返回 `wx_openid` / `invitedBy` 等敏感字段
- **请求签名**：**砍掉**。云开发函数已能拿到可信 openid，无需额外签名。

### 7.2 部署方案（极简：无 Docker、无 Nginx）

#### 7.2.1 小程序端
1. 微信开发者工具 → 云开发 → 创建环境（生产环境仅 1 个，省测试环境）
2. 写入 AppID、云环境 ID
3. 云函数目录右键 → 上传并部署：云端安装依赖（10 个函数依次上传）
4. 数据库 → 按 4.2 建 12 个集合 + 索引 + 预置 11 个 regions
5. 小程序端上传代码 → 提交审核 → 发布

#### 7.2.2 Web 管理后台（两种任选）

**方案 A：云开发静态托管（推荐）**
```bash
# 无需构建，单 index.html 直接上传
# 云开发控制台 → 静态网站托管 → 上传文件 → 选 index.html
# 即可访问：https://<env-id>.service.tcloudbase.com/index.html
```

**方案 B：单 HTML 传 CDN / 对象存储**
- 把 `index.html` 上传到任意 CDN（腾讯云 COS / 阿里云 OSS / 七牛等）
- 开启静态网站托管 → 拿到访问 URL 即可
- **完全零运维、零服务器**

#### 7.2.3 部署清单（一次搞定）

| 步骤 | 内容 | 耗时 |
|------|------|------|
| 1 | 创建云开发环境（按量付费） | 5 min |
| 2 | 上传 10 个云函数 | 10 min |
| 3 | 建 12 个集合 + 索引 | 10 min |
| 4 | 预置 regions 11 条 | 5 min |
| 5 | 首管理员零配置：系统首次启动无任何 `role=admin` 用户时，第一位登录者自动成为 `role=admin`（`auth` 检测无 admin 即自动赋值，老板部署后直接用微信打开小程序登录即可）；手动插库创建 admin 仅作可选兜底（方式二），无需预置 openid / 环境变量 | 0 min |
| 6 | 上传小程序代码到微信后台 | 5 min |
| 7 | 上传 index.html 到静态托管 | 2 min |
| **合计** | | **~38 分钟** |

#### 7.2.4 砍掉的部署项

| 砍掉项 | 替代 |
|--------|------|
| Docker 容器化 | 纯静态单文件，不需要容器 |
| Nginx 反向代理 | 云托管/CDN 自带 HTTPS、缓存、路由 |
| 开发/测试/预发布三套环境 | 极简版仅 1 套生产环境，开发阶段用开发者个人环境 |
| CI/CD 流水线 | 手动上传即可，3 周项目无必要 |
| GitLab / GitHub Actions | 省掉 |

---

## 7.3 成本明细

### 7.3.1 技术服务费（打包价 5,000元）

| 项目 | 金额 | 工期 | 交付内容 |
|------|------|------|---------|
| 小程序全功能 + 云开发后端 | **5,000元** | 3周 | 22项核心功能 + 蓝牙打印适配 + 部署 + 测试 + 首月免费运维 |

> 5,000元为技术服务费包干价，不细化明细。不含第三方费用。

### 7.3.2 甲方自行承担费用（首年约840元，最低开支）

| 项目 | 首年费用 | 次年起 | 说明 |
|------|---------|--------|------|
| 微信小程序注册 | 300元 | - | 一次性 |
| 微信认证 | 300元 | 300元/年 | 每年续费 |
| 云开发基础包 | 240元/年 | 240元/年 | 19.9元/月，含免费额度 |
| 域名/服务器/SSL | 不需要 | 不需要 | 云开发免这些 |
| **合计** | **约840元** | **约540元/年** | 最小开支 |

### 7.3.3 甲方总投入

| 阶段 | 总费用 |
|------|-------|
| 首年（开发+运维） | 5,000元 + 840元 = **约5,840元** |
| 次年起每年运维 | **约540元/年** |

---

## 8. 蓝牙打印技术详解（v1.0 必做）

### 8.1 技术栈

| 层 | 技术 |
|----|------|
| 小程序 API | `wx.openBluetoothAdapter` / `wx.startBluetoothDevicesDiscovery` / `wx.createBLEConnection` / `wx.getBLEDeviceServices` / `wx.getBLEDeviceCharacteristics` / `wx.writeBLECharacteristicValue` |
| 协议 | BLE 4.0+、GATT |
| 指令集 | ESC/POS（通用热敏打印机指令集） |
| 分包 | 每包 ≤ 20 字节，间隔 50ms |

### 8.2 连接流程

```
小程序                          热敏打印机
  │
  │──1. openBluetoothAdapter ──►│ 初始化适配器
  │◄──success─────────────────│
  │
  │──2. startBluetoothDevicesDiscovery ─►│ 搜索周围 BLE 设备
  │◄──onBluetoothDeviceFound────│ 返回设备列表
  │     (本地过滤：名称含 XP/GP/A-58/MT-58 等关键词)
  │
  │──3. createBLEConnection ───►│ 连接指定 deviceId
  │◄──connected────────────────│
  │
  │──4. getBLEDeviceServices ──►│ 取服务列表
  │◄──services[]──────────────│
  │     (选取打印服务：常见 UUID FFE0 / 18F0 等)
  │
  │──5. getBLEDeviceCharacteristics ──►│ 取特征值
  │◄──characteristics[]───────────────│
  │     (选取 Write 属性特征值：FFE1 / 2AF1 等)
  │
  │──6. writeBLECharacteristicValue ─►│ 发送 ESC/POS 字节流
  │    (分包 ≤20B，间隔50ms)
  │◄──write success──────────────────│
  │
  │                            ┌───────┐
  │                            │ 出纸打印 │
  │                            └───────┘
```

### 8.3 ESC/POS 常用指令集（字节码）

| 功能 | 指令（十六进制） | 说明 |
|------|------------------|------|
| 初始化打印机 | `1B 40` | ESC @，清除缓存 |
| 对齐：左/中/右 | `1B 61 00` / `1B 61 01` / `1B 61 02` | ESC a n，n=0左 1中 2右 |
| 加粗 | `1B 45 01`（开）/ `1B 45 00`（关） | ESC E n |
| 字体放大 | `1D 21 00`（正常）/ `1D 21 11`（宽2高2倍）/ `1D 21 22`（宽3高3倍） | GS ! n，高4位宽放大、低4位高放大 |
| 换行 | `0A` | LF |
| 切纸（部分） | `1D 56 01` | GS V 1（部分切，留连点） |
| 切纸（全） | `1D 56 00` | GS V 0（全切） |
| 打印并走纸 n 行 | `1B 64 n` | ESC d n |
| 下划线 | `1B 2D 01`（开）/ `1B 2D 00`（关） | ESC - n |
| 二维码 | 见 8.5 节 | 用 GS ( k 系列指令 |
| CODE128 条形码 | 见 8.5 节 | 用 GS k m d1...dk NUL |

### 8.4 三款主流热敏打印机参数（推荐采购）

| 项目 | 芯烨 XP-58IIH（蓝牙版） | 佳博 GP-58MBIII+（蓝牙版） | 美团 MT-58W（蓝牙版） |
|------|-------------------------|---------------------------|-----------------------|
| **打印宽度** | 58mm | 58mm | 58mm |
| **分辨率** | 203 DPI | 203 DPI | 203 DPI |
| **打印速度** | 90mm/s | 70mm/s | 80mm/s |
| **蓝牙版本** | BLE 4.2 | BLE 4.0 | BLE 4.2 |
| **打印服务 UUID** | `0000FFE0-...` | `0000FFE0-...` | `000018F0-...` |
| **写特征值 UUID** | `0000FFE1-...` | `0000FFE1-...` | `00002AF1-...` |
| **纸宽兼容** | 57.5±0.5mm | 57.5±0.5mm | 57.5±0.5mm |
| **一行字符数（12×24）** | 32 列中文 / 32 列英文 | 32 列 | 32 列 |
| **切纸方式** | 手撕 | 手撕 | 手撕 |
| **参考售价（元）** | ~120 | ~100 | ~110 |
| **ESC/POS 兼容性** | ✅ 完整 | ✅ 完整 | ✅ 完整 |
| **二维码支持** | ✅ GS(k) | ✅ GS(k) | ✅ GS(k) |

> **结论**：三款通用 BLE 58mm 热敏打印机完全兼容 ESC/POS 指令集，小程序统一按「服务 UUID FFE0/18F0 双候选 + 特征值 FFE1/2AF1 双候选」自动匹配，无需绑定品牌。

### 8.5 二维码与条形码打印（ESC/POS 指令）

#### 8.5.1 二维码打印（QR Code，推荐型号 49）

```
GS ( k  设置二维码
格式：1D 28 6B <pL> <pH> <cn> <fn> <参数>
```

**完整步骤**（以打印订单号二维码为例）：

| 步骤 | 指令（十六进制） | 说明 |
|------|------------------|------|
| 1. 设置二维码型号 | `1D 28 6B 03 00 31 41 32 00` | cn=49(0x31), fn=65(0x41), model=2(QRCODE) |
| 2. 设置二维码模块大小 | `1D 28 6B 03 00 31 43 08` | fn=67, size=8(默认) |
| 3. 设置纠错等级 | `1D 28 6B 03 00 31 45 31` | fn=69, level=1(L), 2(M), 3(Q), 4(H) |
| 4. 存入数据 | `1D 28 6B <pL> <pH> 31 50 30 <data bytes>` | fn=80(0x50), 存数据。数据长度 = (pH<<8)+pL - 3 |
| 5. 打印二维码 | `1D 28 6B 03 00 31 51 30` | fn=81(0x51), 执行打印 |

**示例代码**（JS 字节数组）：
```javascript
function buildQRCodeBytes(text) {
  const textBytes = new TextEncoder().encode(text);
  const dataLen = textBytes.length + 3;
  const pL = dataLen & 0xFF;
  const pH = (dataLen >> 8) & 0xFF;
  return [
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x41, 0x32, 0x00,  // 型号
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08,        // 模块大小
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31,        // 纠错 L
    0x1D, 0x28, 0x6B, pL,   pH,   0x31, 0x50, 0x30,        // 存数据头
    ...textBytes,                                            // 数据内容
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30         // 打印
  ];
}
```

#### 8.5.2 条形码打印（CODE128）

```
GS k  打印条形码
格式：1D 6B <m> <d1>...<dk> <NUL>
m = 73 (0x49) → CODE128
```

**打印订单号 CODE128 步骤**：

| 步骤 | 字节 |
|------|------|
| 设置 HRI 字符在条码下方 | `1D 48 02`（GS H n, n=2 下方） |
| 设置条码高度 | `1D 68 50`（GS h n, n=80px） |
| 设置条码宽度 | `1D 77 02`（GS w n, n=2 中等） |
| 打印 CODE128 | `1D 6B 49 <len> <CODE128 bytes> 00` |

**JS 示例**：
```javascript
function buildCode128Bytes(text) {
  // CODE128B 编码：ASCII 32-127 直接用，前加 Start B (104)，后加 Checksum，Stop (106/107)
  const bytes = [];
  bytes.push(0x1D, 0x48, 0x02);        // HRI 下方
  bytes.push(0x1D, 0x68, 0x50);        // 高度 80
  bytes.push(0x1D, 0x77, 0x02);        // 宽度 2
  bytes.push(0x1D, 0x6B, 0x49);        // GS k m=73 CODE128
  // 简化：调用者自行确保 text 为 CODE128 可编码字符；此处直接转 ASCII + NUL 结束
  const ascii = [...new TextEncoder().encode(text)];
  bytes.push(ascii.length, ...ascii, 0x00);
  return bytes;
}
```

### 8.6 完整小票模板（ESC/POS 字节流示例）

```
┌──────────────────────────────┐
│      丰淮商贸 · 采购小票       │  ← 居中 + 2倍放大 + 加粗
│  ─────────────────────────── │  ← 32个 "-"
│  订单号：丰淮商贸-20260730-0001 │
│  客户：XX餐厅                 │
│  区域：汉滨区                 │
│  时间：2026-07-30 10:30      │
│  经办人：张三                 │
│  ─────────────────────────── │
│  商品       数量      金额    │  ← 加粗表头
│  ─────────────────────────── │
│  有机西红柿  1件5包  145.00   │  ← 数量列字体放大（1.5倍+加粗）；件+包合并1行
│  土鸡蛋      5盒    150.00   │
│  五花肉      5斤     20.50   │
│  ─────────────────────────── │
│  合计：255.50 元             │  ← 加粗 + 放大
│  ─────────────────────────── │
│  [ 二维码：订单号 ]           │  ← 订单号 QR Code
│  ─────────────────────────── │
│  [ 条形码：丰淮商贸-202607... ] │  ← 订单号 CODE128
│                              │
│       感谢惠顾！              │  ← 居中
│                              │
│  （走纸 3 行，手撕位置）      │
└──────────────────────────────┘
```

### 8.7 分包发送策略（BLE ≤ 20B/包）

```javascript
const MAX_PACKET = 20;
const INTERVAL = 50; // ms

async function sendAllPackets(deviceId, serviceId, charId, bytes) {
  for (let i = 0; i < bytes.length; i += MAX_PACKET) {
    const chunk = bytes.slice(i, i + MAX_PACKET);
    await wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId: charId,
      value: new Uint8Array(chunk).buffer
    });
    await new Promise(r => setTimeout(r, INTERVAL));
  }
}
```

> 注意：`wx.writeBLECharacteristicValue` 的 `value` 必须是 `ArrayBuffer`，用 `Uint8Array.from(chunk).buffer` 转换。

### 8.8 异常处理与降级

| 异常 | 处理 |
|------|------|
| 蓝牙未开启 | `wx.showModal` 提示用户开启蓝牙和定位 |
| 搜索不到设备 | 提示靠近打印机、检查电源；支持手动输入设备名称过滤 |
| 连接失败（3次重试） | 降级：生成小票图片 `wx.canvasToTempFilePath` → 保存到相册 → 提示「图片已保存，可通过其他App打印」 |
| 写入超时 | 断连 → 重连 → 重新发送 |

---

## 附录

### 附录 A：订单编号生成规则

```
格式：丰淮商贸-YYYYMMDD-NNNN
示例：丰淮商贸-20260803-0001

逻辑：
1. 当日日期 YYYYMMDD
2. orders 集合按 order_no 倒序查当日首条 → 提取 NNNN + 1
3. 补零到 4 位；并发冲突靠唯一索引 + 重试 3 次
4. network_time 取云函数 new Date()（可信网络时间）
```

### 附录 B：云函数目录结构

```
cloudfunctions/
├── auth/                index.js + package.json
├── products/            index.js + package.json
├── customers/           index.js + package.json
├── orders/              index.js + package.json
├── users/               index.js + package.json
├── regions/             index.js + package.json
├── receivable/          index.js + package.json
├── system/              index.js + package.json
├── smart/               index.js + package.json
├── report/              index.js + package.json

共 10 个云函数，无 shared 目录（极简，公共逻辑直接复制到各函数，省包管理复杂度）
```

### 附录 C：~~Web 后台单文件部署注意事项~~（**不适用，已作废**）

> **不适用**：本产品无 Web 后台，MVP 为纯微信原生小程序 + 微信云开发，无跨域与静态托管问题。原内容为 v4.0 之前的早期草案，仅作历史记录保留。SheetJS 导出在小程序端实现，云环境 ID 配置于 `app.js` 的 `wx.cloud.init({ env })`。

### 附录 D：版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-07-28 | 初版发布（方案A：5周 28500元，30+云函数 12集合） |
| v1.1 | 2026-07-29 | 方案A终版，补临时改价、账号继承、数据备份等 31 项 |
| **v2.0** | **2026-07-30** | **方案B（极简版）：3周 5000元；架构→小程序+单HTML→云函数(8个)→MongoDB(6集合)；砍 Element/Pinia/Router/ECharts/ExcelJS/Docker/Nginx；Excel导出改 SheetJS 前端；蓝牙打印升级为 v1.0 必做，新增 ESC/POS 指令、三款机型参数、二维码/条形码详解** |
| **v3.0** | **2026-07-30** | **纯小程序双方案版：砍Web后台、砍蓝牙打印；新增方案A(云开发)/方案B(轻量服务器)双选；技术服务费5,000元包干不细化；甲方最少费用方案A首年仅840元** |
| **v4.0** | **2026-07-30** | **方案A唯一方案定稿：砍Web后台，保留蓝牙打印；微信云开发后端；技术服务费5,000元包干；甲方首年仅840元** |
| **MVP v1.0** | **2026-08-05** | **MVP 口径修订（最终功能范围，无二期增强）**：新增 §6.1A 0元订单拦截与0件0个过滤、§6.1B 销售单模板（西安迈尚版）、§6.1C 全局字号缩放；`users` 新增 `fontScale` 字段；商品/客户 write 云函数放开为**全角色 CRUD**；Web 后台相关章节（§3.3、附录 C、`username`/`password_hash`）标注为不适用；催收闭环/审计日志/趋势报表改为 MVP 不含的独立升级模块；工期口径统一为 **MVP 约 33 人天** |
| **v4.1** | **2026-08-03** | **同步需求变更清单 v2.0（10条）：订单流程改并行（分拣确认发货∥库管配货）、新增 checked 状态、配货暂存 pick_large/medium/small（不改状态）、"配完"确认 confirm（ship_large/medium/small）、收款登记 collect、库管价格脱敏、订单号前缀"丰淮商贸-YYYYMMDD-NNNN"、仓库精简视图、打印模板合并行/去规格列/数量字体放大/收款状态、商品默认数量0、products.usage 排序、单位"零包"→"包"、提交二次确认文案** |
| **v4.2** | **2026-08-03** | **新增已确认需求#11「订单转发给客户」：下单员/管理员在订单详情弹窗/送货单预览页点「📤 转发给客户」，前端基于订单详情数据生成「订单收款卡片」（丰淮商贸抬头+订单号+客户+商品件包明细+应付金额+商户收款码+付款提示）转发微信，客户扫码付款后复用 collect-payment「确认收款」；纯前端动作不新增后端接口（扩展点：orders.shared_at 可选）；草稿/取消订单不可转发；新增验收用例 AC-21。另含需求#12「物流包裹展示与导出」（ship_large/medium/small 列表卡片+详情展示，主报表/出库单/单订单导出，新增 AC-22）** |
| **v4.3** | **2026-08-04** | **赊销收款管理版（对齐产品 v4.3）：①取消商户收款码与央行259号文合规（送货单/订单/卡片不再印制，转发收款卡片 4.3.8/6.5 整体下线）；②全员订单权限：下单/改单/删单放开至 4 角色（含订单内改价），取消分拣员只读与库管价格脱敏（完整视图）；③订单内自定义价格：全商品可改仅当前订单有效（is_price_modified + original_price_*），不限可调价档位；④客户上次价格：新开单默认取该客户最近订单成交价，无历史回退商品默认价；⑤录单页单栏布局（通过「+ 添加商品」弹窗选品）；⑥订单列表当日按客户分组完整卡片 + 历史折叠单行；⑦收款改两步：payments 独立集合（registered_by→库管 confirmed_by），新增 collect-confirm（确认收款）与 receivable（赊销看板）action，orders.collect → payment_status（unpaid/pending/paid）+ received_amount，支持部分收款累计与折价/货损（discount）；⑧赊销收款管理独立Tab「赊销」（客户维度每日欠款+累计总欠款，全角色可见）；⑨订单备注修改、标记已打印放开至全员；⑩更新收款/转发相关验收用例，新增 AC-23~26** |
| **v4.3.6** | **2026-08-04** | **收款角色权责分离**：明确「下单员/分拣员 = 收款责任人（仅登记收款）、库管 = 仅确认收款（不登记、无登记权限）、管理员 = 两者皆可」。统一【收款】按钮按角色分流——下单员/分拣员点开【收款登记】；库管点【收款】只打开【确认收款】列表、不进入登记弹窗（后台 submitCollect 对 warehouse 角色拦截并提示）；库管无 pending 时提示「请等待下单员/分拣员登记」 |
| **v4.3.7** | **2026-08-04** | **赊销新增「收款确认」视图（库管确认工作台）**：赊销页视图切换由「账期/按天」扩展为「账期/按天/收款确认」三视图。`renderConfirmView`：上半区「待库管确认」仅列 `pendingCount(o)>0` 的订单按最早 pending 登记时间升序，展示每笔金额/折价/登记人/登记时间/备注，库管/管理员逐笔【确认】（`confirmCollect`）入账；下半区「已结清」灰显列 `payment_status='paid'` 且含 confirmed 收款的订单（实收/确认人/确认日）。下单员/分拣员在此视图确认按钮灰显「待库管确认」。同时把「按天」视图内残留的「登记/确认」双按钮收敛为统一【收款】按钮，全原型收款交互一致 |
| **v4.4** | **2026-08-07** | **角色权限矩阵细粒度化**：权限键按模块分组、可在「成员管理 → 权限配置」开关（sort:task / warehouse:confirm / receivable:collect / receivable:confirm 等），默认全员开放；管理员关闭某角色权限后对应 Tab/功能运行时自动隐藏 |
| **v4.5** | **2026-08-07** | **分拣与库管合并为「分拣出库」单一 Tab + 赊销三栏重设计**：①分拣与库管合并为「分拣出库」（满足微信 tabBar 5 个上限）；②赊销页三栏（📋客户台账 / 📌未结清 / ✅已结清 + 独立「收款确认」按钮），统一「已收」口径（应收 = 已收 + 未结清）；③出库页子区按角色身份门控（分拣员仅见分拣、库管仅见出库、管理员/下单员全见） |

### 附录 E：验收测试用例（需求变更清单 v2.1 + 需求#11/#12 + v4.3 赊销收款管理版，共 26 条）

> 优先级：P0 = 核心流程必须通过；P1 = 功能优化必须通过。

| 编号 | 优先级 | 关联需求 | 操作步骤 | 预期结果 |
|------|--------|----------|----------|----------|
| AC-01 | P0 | 简化状态机 | 下单员提交订单（状态→submitted 待分拣）后，分拣员点「全部分拣/开始分拣」一键 `submitted → sorted`（已分拣）；库管点「全部确认/出库确认」一步 `sorted → confirmed`（已出库）→ `completed`（已完成） | 分拣为一键「待分拣→已分拣」，出库为库管一步「已分拣→已出库」，无暂存配货/超时自动（物流件型 `ship_*` 已随一步出库确认 MVP 实现，在确认时录入）；提交后任意时刻可手动 cancelled |
| AC-02 | P1 | 二期规划：暂存配货（见 §6.6） | 库管对 submitted/sorted 订单录入配货件数 pick_large/pick_medium/pick_small | **当前 MVP 不实现**：「暂存配货」移入 §6.6 二期规划，`save-pick` action 取消，不改变订单状态 |
| AC-03 | P1 | 物流件型（MVP已实现，见 §4.3.3/§6.5） | 出库时录入实际发货件数 ship_large/ship_medium/ship_small | **MVP已实现**：库管一步【确认出库】时填写物流件型，订单详情/出库列表/报表/出库单展示「物流包裹：大件X · 中件X · 小件X」；不再依赖原「配完」中间态 |
| AC-04 | P1 | 二期规划：超时自动（见 §6.6） | 14:00 / 16:00 触发 SLA 自动确认 | **16:00 出库超时自动定时为二期，但原型保留「⏰模拟16:00通过」手动模拟按钮（simulateAutoConfirm），点击把当日待出库订单置为已出库**；**14:00 分拣超时自动确认保持二期（无对应模拟按钮）**；日常分拣/出库仍由人工一键/一步操作 |
| AC-05 | P0 | 收款登记（v4.3 两步；订单级收款方式取消，收款渠道现金/微信保留） | 下单员/分拣员对订单登记收款：method 收款渠道（现金/微信）+ amount 实收金额（可填 discount 折价/货损）+ 备注 | 保存成功，payments 新增记录（status=pending，method=现金/微信，registered_by/at 写入，无订单级 pay_method 字段），订单 payment_status → pending；订单详情显示"待确认" |
| AC-06 | P0 | 收款状态显示（3态） | 查看未收款订单的详情并打印送货单 | 显示"未收款"；登记收款后刷新显示"待确认"；库管确认收款后显示"已收款（含实收金额）"；收款登记/确认界面可选"现金/微信"渠道（用于台账"现余/微信"拆分），打印送货单按客户格式不含收款方式/状态 |
| AC-07 | P0 | 全员完整视图（v4.3） | warehouse/分拣员角色打开订单列表/详情/打印预览 | 单价、金额完整显示（无脱敏、无精简视图），4 角色视图一致 |
| AC-08 | P1 | 默认数量0 | 录单页添加商品 | 商品数量默认 0，需手动输入后加购，不会误带 1 |
| AC-09 | P1 | usage 排序 | 录单页打开商品列表 | 商品按使用频率（products.usage）降序排列，高频商品置顶 |
| AC-10 | P1 | 当日分组+历史折叠（v4.3） | 打开订单列表查看当日订单与昨天及更早订单 | 当日订单按客户分组显示完整卡片；昨天及更早折叠为单行摘要，可点击展开 |
| AC-11 | P1 | 订单号前缀 | 提交任意订单 | 订单号格式为「丰淮商贸-YYYYMMDD-NNNN」，无 FH- 前缀 |
| AC-12 | P1 | 提交二次确认 | 下单员提交订单，弹出确认框 | 文案为「（区域-店名）的订单 数量与订单数量确认无误？」，不含订单号与金额 |
| AC-13 | P1 | 修改备注（v4.3 全员） | 任意角色对任意订单修改备注 | 任意状态均可保存 orders.remark，详情页实时更新 |
| AC-14 | P1 | 打印合并行 | 打印订单明细/送货单，商品同时含件与包 | 同商品合并 1 行显示「N件M包」，无"规格"列，数量列字体放大（≥1.5 倍并加粗） |
| AC-15 | P1 | 收款码下线（v4.3） | 打印送货单 / 查看订单页 / 导出报表 | 全端检索不到商户收款码、经营码、259号文内容；送货单仅含收款状态 |
| AC-16 | P1 | 单位"包" | 查看订单明细/打印件 | 零数单位统一显示为"包"（原"零包"），全程无"零包"字样 |
| AC-17 | P1 | 输入框加大 | 录单页输入数量 | 数量输入框尺寸加大，便于点击输入 |
| AC-18 | P1 | 商品选择弹窗 | 录单页打开商品选择弹窗，先查看默认列表，再输入搜索词查看 | 弹窗默认只罗列 4 行常购/高频商品；输入搜索词后展示全部匹配商品 |
| AC-19 | P1 | 客户常购排序 | 为「固定商家（客户）」打开商品选择弹窗 | 商品按该客户历史订单商品购买量（常购次数）降序优先排列，其次按全局使用频率降序；常购商品置顶 |
| AC-20 | P1 | usage 动态累计 | 新建订单成功提交后重新打开商品选择弹窗；再以「新客户」身份打开弹窗 | 订单内每个商品 products.usage 自动 +1（选择越多的越靠前）；新客户（无历史订单）选品时按全局使用频率 { usage: -1 } 排序 |
| AC-21 | P0 | 全员下单/改单/删单（v4.3） | 下单员/分拣员/库管/管理员 4 角色分别新建、修改、删除订单 | 4 角色均可创建/改单/删单（含订单内改价），无只读或价格脱敏限制 |
| AC-22 | P1 | 物流包裹展示与导出（MVP已实现，见 §4.3.3/§6.5） | ① 库管对已分拣(sorted)订单做出库确认，录入 ship_large/ship_medium/ship_small 后，查看库管工作台「已出库」列表卡片与订单详情弹窗/详情页；② 导出主报表、出库单、单订单；③ 查看未出库订单 | **MVP已实现**：①「已出库」列表卡片显示「物流包裹：大件X · 中件X · 小件X」，所有角色可见；② 主报表与出库单导出含「发货大件/发货中件/发货小件」3 列（订单级）；③ 未出库订单物流包裹为空/0 |
| AC-23 | P0 | 订单内自定义价格（v4.3） | 任意商品在订单内修改单价（如100元改90元）并提交；再开新单查看该商品 | 本单按自定义价计价，快照记 is_price_modified=true + original_price_*=100；新开单价格回退默认（不影响商品默认价与其他订单） |
| AC-24 | P0 | 客户上次价格（v4.3） | 为有历史订单的客户新建订单，不传单价 | 商品单价自动带出该客户最近一单成交价；无历史客户回退商品默认价 |
| AC-25 | P0 | 赊销页三栏（v4.5） | 打开底部 Tab「赊销」；查看三栏（📋客户台账 / 📌未结清 / ✅已结清）+ 独立「✅ 收款确认」按钮；对有欠款客户核对 应收总额/已收/未结清 | 以客户为单位展示 **应收总额 / 已收 / 未结清**（金额守恒：应收=已收+未结清），用「已收」替代旧「已结清」；部分收款多次累计、折价（应付-实收）正确计入剩余欠款；欠款为0客户可隐藏 |
| AC-26 | P0 | 收款两步确认（v4.3） | 下单员/分拣员登记收款（订单→pending）；库管在赊销页/订单详情确认收款；尝试由分拣员确认 | 登记后 payment_status=pending（payments.status=pending）；库管确认后 → paid（received_amount 累加，confirmed_by/at 写入）；分拣员无确认权限（返回 2002） |
| AC-27 | P1 | 新建订单默认未付款（v4.3.2/v4.3.4/v4.3.5） | 新建订单不再选择收款方式，统一默认未付款；v4.3.5 起订单数据彻底移除 `payment` 字段 | 订单 payment_status 均为 unpaid、received_amount=0、无 payment 字段；赊销/应收款视图纳入该未付款单 |
| AC-28 | P1 | 转发客户微信（v4.3.2） | 新建订单提交后看是否弹转发层；订单详情点【转发客户微信】→【发送给客户微信】 | 弹出订单明细卡片预览；点击发送后订单 shared_to_wechat=true、shared_at 写入，详情「微信转发」行显示已转发；内容不含任何收款码 |

---

> **文档结束**  
> 如有疑问，请联系技术负责人评审后修改。
