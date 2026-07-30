# 丰淮商贸采购下单助手 — 技术规格书（TDD）

> **文档版本**：v4.0（方案A唯一定稿：小程序+云开发+蓝牙打印，无Web后台）  
> **编写日期**：2026-07-30  
> **状态**：已定稿  
> **目标读者**：前端工程师、后端工程师、测试工程师  
> **对应版本**：v4.0（方案A唯一方案，3周交付，技术服务费5,000元）  
> **工期**：3周  
> **预算**：5,000元（技术服务费包干，不含小程序注册/认证/云资源等甲方承担的第三方费用）

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
| Web后台 | ❌ 不做任何Web后台页面 |
| 技术服务费 | 5,000元（包干，3周交付） |
| 甲方首年费用 | 约840元（小程序注册+认证+云开发） |
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
│  │  │  8个云函数    │    │  云开发数据库      │   │    │
│  │  │  (Node.js)   │    │  (MongoDB 6集合)  │   │    │
│  │  └──────────────┘    └──────────────────┘   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│                    服务端层                          │
└─────────────────────────────────────────────────────┘
```

**架构极简说明**：
- 无自建服务器、无 Docker、无 Nginx 反向代理
- 无任何Web后台页面，全员通过小程序操作
- 所有后端逻辑封装在 8 个云函数内
- 数据库仅 6 个核心集合，无冗余

### 2.2 核心数据流

#### 2.2.1 下单流程（主路径）

```
[小程序]                     [云函数]                  [数据库]
  │  1. 加载商品列表            │                          │
  │──调用 data-query ─────────►│────查询 products 集合───►│
  │◄──返回商品数据────────────│◄──返回文档列表────────────│
  │                            │                          │
  │  2. 选择商品加入购物车       │                          │
  │  (本地 Storage 缓存)        │                          │
  │                            │                          │
  │  3. 提交订单                │                          │
  │──调用 order-write ────────►│                          │
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
| **数据库** | 云开发数据库（MongoDB） | — | MongoDB 兼容；6 个集合极简建模；与云函数零延迟 |
| **蓝牙打印** | 微信蓝牙 API + ESC/POS | — | wx.openBluetoothAdapter + wx.createBLEConnection；通用 BLE 热敏打印机 |
| **认证** | 微信登录（openid） | — | 小程序端 wx.login 换 openid；Web 后台用 openid + 共享密钥校验（极简） |
| **Web 后台部署** | 云开发静态托管 / CDN / 单HTML直传 | — | 无 Docker 无 Nginx；index.html 直接上传即可访问 |

### 3.2 砍掉的技术（极简原则）

| 砍掉项 | 原因 |
|--------|------|
| Element Plus | Web 后台用纯 HTML 表格 + 原生 JS 即可，无需重型 UI 库 |
| Vue 3 全家桶（Pinia / Vue Router） | 后台用单 HTML 多标签页切换，无需路由和状态管理 |
| ECharts | 先不做图表，经营分析用 Excel 导出自行透视 |
| ExcelJS | 导出改前端 SheetJS 完成，省掉云函数 CPU 和云存储费用 |
| MobX-miniprogram | 小程序用 wx.setStorage + 页面 data 即可，无需状态管理库 |
| Docker / Nginx 反向代理 | Web 后台为纯静态文件，云托管/CDN 解决一切 |
| 请求签名/HMAC | 云开发天然鉴权（云函数内可拿到 openid），无需额外签名层 |

### 3.3 Web 后台代码规范（单 HTML 文件）

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

### 3.4 云函数命名与编写规范

**仅 8 个云函数**（`module-action` kebab-case）：

| 序号 | 云函数名 | 职责 |
|------|----------|------|
| 1 | `auth-login` | 微信登录换 openid、返回用户信息 |
| 2 | `data-query` | 通用查询：商品/客户/区域/订单/用户列表+详情+筛选 |
| 3 | `product-write` | 商品增、改（不做删，软删用 status） |
| 4 | `customer-write` | 客户增、改 |
| 5 | `order-write` | 订单创建、状态变更、临时改价 |
| 6 | `region-write` | 区域增、改 |
| 7 | `user-write` | 用户增、改、禁用 |
| 8 | `system-config` | 系统配置读写（预留，极简版仅用默认值） |

**编写规范**：
- 入口：`exports.main = async function(event, context) { ... }`
- 初始化：顶部 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`
- 错误处理：所有异步 `try/catch`，统一返回 `{ code, message, data }`
- 模块依赖：CommonJS `require`，不用 ES Module

---

## 4. 数据库设计

### 4.1 集合总览（仅 6 个）

| 序号 | 集合名 | 说明 | 数据量级预估 |
|------|--------|------|-------------|
| 1 | `users` | 系统用户（含角色、wx_openid） | < 1,000 条 |
| 2 | `products` | 商品信息（SKU 主数据） | < 10,000 条 |
| 3 | `customers` | 客户信息（含区域冗余） | < 50,000 条 |
| 4 | `orders` | 订单主表（含商品快照） | > 100 万条 |
| 5 | `order_items` | 订单明细 | > 500 万条 |
| 6 | `regions` | 客户区域（11 个预置 + 可扩展） | < 200 条 |

**砍掉的冗余集合**：
- ~~categories~~：分类合并到 products.category 字段（字符串枚举即可，无多级分类需求）
- ~~price_changes~~：改价直接在 order_items 记 original_price + is_price_modified 标记
- ~~account_inheritance_logs~~：直接在 users 表标记 inherited_from，不记独立日志
- ~~operation_logs~~：极简版不做操作审计日志
- ~~system_configs~~：合并到 `system-config` 云函数内默认配置，独立集合无必要
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
| `price_zero` | Number | ❌ | `null` | 零价 |
| `pinyin` | String | ❌ | `""` | 拼音首字母 |
| `status` | String | ✅ | `"active"` | active / disabled |
| `sort` | Number | ❌ | `0` | 排序值 |
| `created_by` | String | ❌ | `null` | 创建人ID |
| `created_at` | Date | ✅ | `new Date()` | 创建时间 |
| `updated_at` | Date | ✅ | `new Date()` | 更新时间 |

**索引**：
- `{ sku_code: 1 }` 唯一索引
- `{ category: 1, status: 1, sort: 1 }` 分类浏览
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
| `username` | String | ❌ | `""` | Web 后台登录用户名 |
| `password_hash` | String | ❌ | `""` | 密码哈希（bcrypt） |
| `name` | String | ✅ | — | 真实姓名 |
| `phone` | String | ❌ | `""` | 手机号 |
| `role` | String | ✅ | `"orderer"` | admin / orderer / warehouse |
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
| `order_no` | String | ✅ | — | FH-YYYYMMDD-NNNN |
| `customer_id` | String | ✅ | — | 客户ID |
| `customer_name` | String | ✅ | — | 客户名称（冗余） |
| `customer_region` | String | ✅ | — | 客户区域（冗余） |
| `total_amount` | Number | ✅ | `0` | 总金额（4位小数存储，2位显示） |
| `item_count` | Number | ✅ | `0` | 商品种类数 |
| `total_qty` | Number | ✅ | `0` | 总数量 |
| `status` | String | ✅ | `"draft"` | draft / submitted / confirmed / completed / cancelled |
| `payment_method` | String | ✅ | `"cash"` | cash / credit |
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
| `completed_at` | Date | ❌ | `null` | 完成时间 |
| `cancelled_at` | Date | ❌ | `null` | 取消时间 |
| `cancelled_reason` | String | ❌ | `""` | 取消原因 |

**状态机**：
```
draft → submitted → confirmed → completed
  ↓         ↓            ↓
  └──── cancelled ────────┘
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
| `zero_qty` | Number | ✅ | `0` | 零数 |
| `unit_price_piece` | Number | ✅ | — | 件价（快照，可改价） |
| `unit_price_zero` | Number | ✅ | — | 零价（快照，可改价） |
| `is_price_modified` | Boolean | ✅ | `false` | 是否改价 |
| `original_price_piece` | Number | ❌ | `null` | 原始件价（改价前，替代独立 price_changes 表） |
| `original_price_zero` | Number | ❌ | `null` | 原始零价（改价前） |
| `amount` | Number | ✅ | — | 小计金额 |
| `remark` | String | ❌ | `""` | 单项备注 |
| `snapshot_at` | Date | ✅ | `new Date()` | 快照时间 |

**索引**：`{ order_id: 1 }`、`{ product_id: 1 }`

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
      "zero_qty": 5,
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
1. `user-write` 云函数接收 `{ from_user_id, to_user_id }`
2. 批量更新 `orders.created_by`、`customers.created_by`、`products.created_by` 字段
3. 设置原用户 `status=disabled`、`is_inherited=true`、`inherited_from` 空
4. 新用户 `is_inherited=true`、`inherited_from=from_user_id`

---

## 5. 接口设计

### 5.1 云函数总览（仅 8 个）

| 云函数名 | 入参 event 字段 | 返回 data | 权限 |
|----------|----------------|-----------|------|
| **auth-login** | `{ code }`（wx.login code） | `{ token, user }` | 公开 |
| **data-query** | `{ type, filter, page, page_size, sort }`<br>`type` ∈ products/customers/regions/orders/order_items/users | `{ list, pagination }` 或单条详情 | 登录用户按角色过滤 |
| **product-write** | `{ action: 'create'/'update', data, id? }` | `{ _id }` | admin/orderer |
| **customer-write** | `{ action: 'create'/'update', data, id? }` | `{ _id }` | admin/orderer |
| **order-write** | `{ action, id?, data }`<br>`action`: create/update-status/copy/modify-price/mark-printed | `{ order_id, order_no }` | 按 action 校验角色 |
| **region-write** | `{ action: 'create'/'update', data, id? }` | `{ _id }` | admin |
| **user-write** | `{ action: 'create'/'update'/'disable'/'inherit', data, id?, from_id?, to_id? }` | `{ _id }` | admin |
| **system-config** | `{ action: 'get'/'set', key?, value? }` | `{ config }` | admin |

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

### 5.4 data-query 通用查询规范

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
- orderer：`orders.created_by == 当前用户id`、`customers/products.created_by` 可看全部
- warehouse：orders 可看全部，无用户管理权限
- admin：全部权限

---

## 6. 关键模块实现方案

### 6.1 数据快照机制

订单创建在 `order-write` 云函数 `action=create` 中一次性完成：
1. 校验 `customer_id` 有效性
2. 遍历 items → 查询 `products` → 构建快照
3. 计算总金额
4. 生成订单号 `FH-YYYYMMDD-NNNN`（当日倒序查最大号+1）
5. 写入 `orders`（含 items_snapshot）和 `order_items`
6. 任一环节失败，整体返回错误

### 6.2 Excel 导出（前端 SheetJS，不写云函数）

**实现代码（Web 后台 <script> 内）**：

```javascript
async function exportOrders(filter) {
  // 1. 调用 data-query 拉取全部数据（page_size=10000）
  const res = await callCloud('data-query', {
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
        零数: item.zero_qty,
        件价: item.unit_price_piece,
        零价: item.unit_price_zero,
        小计: item.amount,
        订单总金额: order.total_amount,
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
    {wch:10},{wch:8},{wch:10},{wch:20}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '订单明细');
  XLSX.writeFile(wb, `订单导出_${formatDate(new Date())}.xlsx`);
}
```

**说明**：无云函数 CPU 开销、无云存储费用、无临时链接过期问题。大数据量（> 2000 条）时建议用户缩小日期范围。

### 6.3 后台打印方案（window.print() + @page 241mm）

**CSS**：
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
}
```

**流程**：
1. 订单列表勾选 → 点"打印出货单"
2. 前端按 `@page 241mm` 渲染打印预览 DOM
3. 调 `window.print()` → 浏览器弹出打印对话框
4. 用户选针式打印机（EPSON LQ/映美 FP/富士通 DPK 等），1-3 份多联纸
5. 调 `order-write` 的 `mark-printed` 标记已打印

### 6.4 蓝牙打印方案（小程序端 BLE + ESC/POS）

详见第 8 章「蓝牙打印技术详解」。

---

## 7. 安全与部署

### 7.1 安全设计（极简版）

#### 认证
- **小程序端**：`wx.login()` → `auth-login` 云函数换 `openid` → 匹配 `users.wx_openid` → 返回用户信息。无 JWT，云函数内部通过 `cloud.getWXContext().OPENID` 即可拿到身份（云开发天然安全）。
- **Web 后台端**：用户名 + bcrypt 密码登录成功后，`localStorage` 存 `openid` + `shared_secret` 哈希。调用云函数时在 `event.__auth` 中携带，云函数校验哈希。

#### 权限（RBAC 三角色）

| 角色 | 范围 |
|------|------|
| admin | 全部 8 个云函数全部 action |
| orderer | auth-login、data-query（本人订单+全部商品客户区域）、product-write、customer-write、order-write（本人订单 create/mark-printed/copy） |
| warehouse | data-query（全部订单、不含价格字段？导出时前端过滤）、order-write（update-status: submitted→confirmed、mark-printed） |

> **极简权限校验**：云函数入口处统一 checkRole 中间件，不做细粒度权限标识（省掉 permissions 数组）。

#### 其他安全
- **传输加密**：云开发默认 HTTPS
- **密码**：bcrypt cost=10，单向哈希
- **输入校验**：云函数入口手写 `if/else` 校验必填字段与类型（不引 Joi/Zod 包，省体积）
- **输出过滤**：API 不返回 `password_hash`
- **请求签名**：**砍掉**。云开发函数已能拿到可信 openid，无需额外签名。

### 7.2 部署方案（极简：无 Docker、无 Nginx）

#### 7.2.1 小程序端
1. 微信开发者工具 → 云开发 → 创建环境（生产环境仅 1 个，省测试环境）
2. 写入 AppID、云环境 ID
3. 云函数目录右键 → 上传并部署：云端安装依赖（8 个函数依次上传）
4. 数据库 → 按 4.2 建 6 个集合 + 索引 + 预置 11 个 regions
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
| 2 | 上传 8 个云函数 | 10 min |
| 3 | 建 6 个集合 + 索引 | 10 min |
| 4 | 预置 regions 11 条 | 5 min |
| 5 | 创建 1 个 admin 用户（手动插库） | 2 min |
| 6 | 上传小程序代码到微信后台 | 5 min |
| 7 | 上传 index.html 到静态托管 | 2 min |
| **合计** | | **~40 分钟** |

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
│  订单号：FH-20260730-0001     │
│  客户：XX餐厅                 │
│  区域：汉滨区                 │
│  时间：2026-07-30 10:30      │
│  经办人：张三                 │
│  ─────────────────────────── │
│  商品       数量      金额    │  ← 加粗表头
│  ─────────────────────────── │
│  有机西红柿  1件5零  145.00   │
│  土鸡蛋      5盒    150.00   │
│  五花肉      5斤     20.50   │
│  ─────────────────────────── │
│  合计：255.50 元             │  ← 加粗 + 放大
│  ─────────────────────────── │
│  [ 二维码：订单号 ]           │  ← 订单号 QR Code
│  ─────────────────────────── │
│  [ 条形码：FH-202607... ]    │  ← 订单号 CODE128
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
格式：FH-YYYYMMDD-NNNN
示例：FH-20260730-0001

逻辑：
1. 当日日期 YYYYMMDD
2. orders 集合按 order_no 倒序查当日首条 → 提取 NNNN + 1
3. 补零到 4 位；并发冲突靠唯一索引 + 重试 3 次
4. network_time 取云函数 new Date()（可信网络时间）
```

### 附录 B：云函数目录结构

```
cloudfunctions/
├── auth-login/          index.js + package.json
├── data-query/          index.js + package.json
├── product-write/       index.js + package.json
├── customer-write/      index.js + package.json
├── order-write/         index.js + package.json
├── region-write/        index.js + package.json
├── user-write/          index.js + package.json
└── system-config/       index.js + package.json

共 8 个云函数，无 shared 目录（极简，公共逻辑直接复制到各函数，省包管理复杂度）
```

### 附录 C：Web 后台单文件部署注意事项

1. **SheetJS CDN 不可访问**的降级：把 `xlsx.full.min.js` 下载后内联到 `<script>` 标签（约 900KB，HTML 单文件 1MB+ 仍可接受）
2. **云环境 ID 硬编码**在 index.html 顶部 `const ENV_ID = 'xxx-xxx'`；如需换环境改一行即可
3. **跨域**：Web 后台调用云函数有两种方式——
   - A 方案：HTTP API（`https://tcb-api.tencentcloudapi.com`，带签名），适合任意域名
   - B 方案（推荐）：云开发静态托管同源部署，直接 `window.tcb.init()` 调用，免签名

### 附录 D：版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-07-28 | 初版发布（方案A：5周 28500元，30+云函数 12集合） |
| v1.1 | 2026-07-29 | 方案A终版，补临时改价、账号继承、数据备份等 31 项 |
| **v2.0** | **2026-07-30** | **方案B（极简版）：3周 5000元；架构→小程序+单HTML→云函数(8个)→MongoDB(6集合)；砍 Element/Pinia/Router/ECharts/ExcelJS/Docker/Nginx；Excel导出改 SheetJS 前端；蓝牙打印升级为 v1.0 必做，新增 ESC/POS 指令、三款机型参数、二维码/条形码详解** |
| **v3.0** | **2026-07-30** | **纯小程序双方案版：砍Web后台、砍蓝牙打印；新增方案A(云开发)/方案B(轻量服务器)双选；技术服务费5,000元包干不细化；甲方最少费用方案A首年仅840元** |
| **v4.0** | **2026-07-30** | **方案A唯一方案定稿：砍Web后台，保留蓝牙打印；微信云开发后端；技术服务费5,000元包干；甲方首年仅840元** |

---

> **文档结束**  
> 如有疑问，请联系技术负责人评审后修改。
