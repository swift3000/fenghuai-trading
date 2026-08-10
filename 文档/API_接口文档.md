# 丰淮商贸采购下单助手 — 接口文档（API）

> **文档版本**：MVP v1.0（2026-08-05 定稿，最终功能范围）
> **编写日期**：2026-08-03  
> **最后更新**：2026-08-04  
> **状态**：已定稿  
> **总接口数**：27 个（原 25 个 + 新增「智能匹配 smart.match」「语音转文字 smart.transcribe」）  
> **调用方式**：微信云函数（`wx.cloud.callFunction`）
> **MVP 口径**：本文档已按 MVP（v1.0，2026-08-05）修订，MVP 为最终功能范围，无二期增强；接口契约以《小程序 MVP 落地计划与技术架构》为准。
> **工期**：约 33 人天（MVP 生产化，详见《工期与工作量评估》）

---

## 1. 通用约定

### 1.1 调用方式

小程序端：
```javascript
wx.cloud.callFunction({
  name: 'order-write',
  data: { action: 'create', payload: { /* ... */ } },
  success: res => { /* res.result = { code, message, data } */ }
});
```

Web 后台端（云开发静态托管同源时用 tcb-js-sdk）：
```javascript
const app = tcb.init({ env: ENV_ID });
const res = await app.callFunction({
  name: 'order-write',
  data: { action: 'create', payload: { /* ... */ }, __auth: token }
});
```

### 1.2 云函数与 Action 对照表（9 个云函数，27 个 action）

| # | 云函数 | Action | 接口名 |
|---|--------|--------|--------|
| 1 | auth-login | — | 用户登录 |
| 2 | data-query | products | 商品列表 |
| 3 | | product-detail | 商品详情 |
| 4 | | customers | 客户列表 |
| 5 | | customer-detail | 客户详情 |
| 6 | | regions | 区域列表 |
| 7 | | orders | 订单列表 |
| 8 | | order-detail | 订单详情 |
| 9 | | users | 用户列表 |
| 10 | | receivable | 赊销（三栏：客户台账/未结清/已结清 + 收款确认；已收口径） |
| 11 | product-write | create | 新增商品 |
| 12 | | update | 修改商品 |
| 13 | customer-write | create | 新增客户 |
| 14 | | update | 修改客户 |
| 15 | order-write | create | 创建订单 |
| 16 | | update-status | 更新订单状态（分拣完成/出库确认/完成/取消；驳回为二期遗留） |
| 17 | | pick-stash | 配货暂存（二期规划·当前未启用） |
| 18 | | collect | 收款登记（下单员/分拣员） |
| 19 | | collect-confirm | 确认收款（库管） |
| 20 | | update-remark | 修改订单备注 |
| 21 | | mark-printed | 标记已打印 |
| 22 | region-write | create | 新增区域 |
| 23 | | update | 修改区域 |
| 24 | user-write | create | 新增用户 |
| 25 | | update | 修改用户 |
| 26 | smart | match | 智能匹配（商品/客户模糊匹配） |
| 27 | | transcribe | 语音转文字 |

### 1.3 返回格式

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "timestamp": 1722172800000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | number | ✅ | 0=成功 |
| message | string | ✅ | 提示，直接展示给用户 |
| data | any | ✅ | 业务数据对象/数组/null |
| timestamp | number | ✅ | 服务端时间戳（毫秒） |

### 1.4 错误码表

| code | message | 处理建议 |
|------|---------|----------|
| 0 | success | — |
| 1001 | 参数错误：xxx | 前端校验补齐参数 |
| 1002 | 未登录或登录已失效 | 跳登录页 |
| 2001 | 无权限执行该操作 | 提示并禁止 |
| 2002 | 数据不存在 | 提示用户或刷新 |
| 2003 | 账户已禁用 | 提示联系管理员 |
| 3002 | 当前订单状态不允许此操作 | 前端按钮 disabled |
| 5001 | 服务器内部错误 | 稍后重试或联系技术 |

### 1.5 状态枚举

| 场景 | Key | 显示文本 |
|------|-----|----------|
| 订单状态 | draft | 草稿 |
| | submitted | 待分拣 |
| | sorted | 已分拣 |
| | confirmed | 已出库 |
| | completed | 已完成 |
| | cancelled | 已取消 |
| | rejected | 已驳回（遗留定义，当前流程不触发，详见二期规划） |
| 收款状态 | unpaid | 未收款 |
| | pending | 待确认（已登记待库管确认） |
| | paid | 已收款 |
| 商品/客户/区域/用户 | active | 启用 |
| | inactive | 停用 |
| 性别 | male | 男 |
| | female | 女 |
| 支付方式 | cash | 现金 |
| | transfer | 转账 |
| | credit | 赊账 |

---

## 2. 认证相关

### 2.1 用户登录

- **云函数**：`auth-login`
- **最小权限**：公开
- **首管理员（方案 A 零配置）**：系统首次启动无任何管理员时，`login` 云函数检测到「当前无 admin」即把**第一位登录者自动赋值为 `role=admin`**（无需预置任何环境变量、也无需先知道 openid）。老板部署后直接用微信打开小程序登录即可，无需配置 `ADMIN_OPENID` 等。预置首管理员 openid（环境变量 `ADMIN_OPENID`）仅作为**可选兜底（方式二）**，主路径为方案 A 零配置。

#### 请求
```typescript
// auth-login 的 event 格式直接为 payload
{
  // 小程序端：不传，云函数内部通过 getWXContext().OPENID 直接拿身份（微信原生，无密码）
  // 邀请绑定：扫码后带 inviteCode，云函数将 openid 写入预建用户并激活
  inviteCode?: string;  // 邀请制绑定时携带
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 后台必填 | Web 后台用户名 |
| password | string | 后台必填 | Web 后台密码（明文） |

#### 返回 data
```typescript
{
  user: {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'orderer' | 'sorter' | 'warehouse';
    avatar: string | null;
    region: string | null;
    region_name: string | null;
    phone: string | null;
  } | null;
  token: string | null;   // Web 后台使用
  need_bind: boolean;     // 小程序 openid 未绑定时为 true
}
```

#### 失败示例
```json
{ "code": 2002, "message": "该微信账号尚未绑定，请联系管理员", "data": null, "timestamp": 1722172800000 }
```

---

## 3. 商品相关

### 3.1 商品列表

- **云函数**：`data-query`
- **Action**：`products`
- **最小权限**：orderer/sorter/warehouse/admin（商品列表全员可见）

#### 请求
```typescript
{
  type: 'products',
  customer_id?: string;   // 下单弹窗场景：传客户 ID，服务端按该客户历史订单商品购买量降序、其次 usage 降序（客户维度常购优先）
  filter?: {
    keyword?: string;
    category?: string;
    status?: 'pending' | 'active' | 'disabled';
  },
  page?: number;
  page_size?: number;
  sort?: { [key: string]: 1 | -1 }   // 支持 usage: -1 按使用频率降序（从高到低）；支持客户维度常购排序（传 customer_id，无 customer_id 时按 usage 降序）
}
```

#### 返回 data (list)
```typescript
{
  list: Array<{
    id: string; sku: string; name: string;
    category: string; spec: string | null; unit: string;
    pricing_mode: 'case' | 'piece' | 'unit';
    pieces_per_case: number | null;
    unit_price_piece: number; unit_price_zero: number;
    original_price: number | null;
    is_93_adjustable: boolean;
    usage: number;              // 使用频率（近 N 日下单次数，服务端自动统计）；新建订单成功自动 +1（服务端累计，选择越多的越靠前），用于排序
    status: 'active' | 'inactive';
    created_by_name: string; created_at: number;
  }>;
  pagination: { page: number; page_size: number; total: number; total_pages: number; }
}
```

### 3.2 商品详情

- **云函数**：`data-query` / `product-detail`
- **最小权限**：orderer/sorter/warehouse/admin（全员可见）

#### 请求
```json
{ "type": "product-detail", "filter": { "_id": "商品ID" } }
```

#### 返回 data（对象）：同 3.1 列表的单条对象字段（含全部字段，无 list 包裹）。

### 3.3 新增商品

- **云函数**：`product-write`
- **Action**：`create`
- **最小权限**：orderer/admin

#### 请求
```typescript
{
  action: 'create',
  payload: {
    sku: string;                // 必填，唯一，长度 3-50
    name: string;               // 必填，长度 1-100
    category?: string;          // 选填，枚举：蔬菜/肉类/冻品/调料/粮油/水产/其他
    spec?: string | null;       // 选填
    unit: string;               // 必填，长度 1-10
    pricing_mode: 'case' | 'piece' | 'unit';
    pieces_per_case?: number;   // case 模式必填，> 0
    unit_price_piece: number;   // 必填，≥ 0
    unit_price_zero: number;    // ≥ 0
    original_price?: number | null;
    status?: 'pending' | 'active' | 'disabled';  // 默认 active
  }
}
```

| 校验规则 | |
|----------|---|
| SKU 唯一 | 同 sku 存在时返回 1001 |
| 93 SKU | 以 93 开头时 is_93_adjustable 自动 = true |

#### 返回 data
```json
{ "id": "新增商品ID", "sku": "编码" }
```

### 3.4 修改商品

- **云函数**：`product-write`
- **Action**：`update`
- **最小权限**：orderer/admin

#### 请求
```typescript
{
  action: 'update',
  payload: {
    id: string;                // 必填
    // 其余字段同新增，全部可选；只传要改的字段
  }
}
```

#### 返回 data：`{ id: string, updated: true }`

---

## 4. 客户相关

### 4.1 客户列表

- **云函数**：`data-query` / `customers`
- **最小权限**：orderer/admin

#### 请求
```json
{ "type": "customers", "filter": { "keyword": "", "region": "", "status": "active" }, "page": 1, "page_size": 20 }
```

#### 返回 data (list)
```typescript
{
  list: Array<{
    id: string; name: string;
    region_id: string; region_name: string;
    address: string | null;
    contact: string | null; phone: string | null;
    status: 'active' | 'inactive';
    is_adjustable: boolean;
    created_by_name: string; created_at: number;
  }>;
  pagination: { /* ... */ }
}
```

### 4.2 客户详情

- **云函数**：`data-query` / `customer-detail`
- **最小权限**：orderer/admin

#### 请求：`{ type: 'customer-detail', filter: { _id: '' } }`

#### 返回 data：同 4.1 列表单条字段，无 list 包裹。

### 4.3 新增客户

- **云函数**：`customer-write`
- **Action**：`create`
- **最小权限**：orderer/admin

#### 请求
```typescript
{
  action: 'create',
  payload: {
    name: string;
    region_id: string;
    address?: string | null;
    contact?: string | null;
    phone?: string | null;
    is_adjustable?: boolean;   // 默认 false
    status?: 'pending' | 'active' | 'disabled';
  }
}
```

#### 返回：`{ id, name }`

### 4.4 修改客户

- **云函数**：`customer-write` / `update`
- **最小权限**：orderer/admin

#### 请求：`{ action:'update', payload:{ id, ...updateFields } }`

#### 返回：`{ id, updated:true }`

---

## 5. 区域相关

### 5.1 区域列表

- **云函数**：`data-query` / `regions`
- **最小权限**：all

#### 请求：`{ type:'regions', filter:{ status:'active' } }`（无分页）

#### 返回 data
```typescript
Array<{
  id: string;
  code: string;                // 示例：HBQ
  name: string;                // 示例：汉滨区
  description: string | null;
  status: 'active' | 'inactive';
  sort: number;                // 排序号，从小到大
}>;
```

### 5.2 新增区域

- **云函数**：`region-write` / `create`
- **最小权限**：admin

#### 请求
```json
{ "action": "create", "payload": { "code": "XYX", "name": "新区域", "sort": 99 } }
```

### 5.3 修改区域

- **云函数**：`region-write` / `update`
- **最小权限**：admin

#### 请求：`{ action:'update', payload:{ id, name, description, sort, status } }`

---

## 6. 订单相关

### 6.1 订单列表

- **云函数**：`data-query` / `orders`
- **最小权限**：orderer/sorter/warehouse/admin（**全部，完整视图，无价格脱敏与精简视图，1.0**）

#### 请求
```typescript
{
  type: 'orders',
  filter: {
    status?: OrderStatus | OrderStatus[];
    network_time_gte?: number;        // 时间戳
    network_time_lte?: number;
    customer_id?: string;
    region?: string;
    keyword?: string;                 // 订单号/客户名
    created_by?: string;              // orderer 专用（前端传）
  },
  page?: number;
  page_size?: number;
  sort?: { network_time?: 1 | -1 }
}
```

#### 返回 data (list)
```typescript
{
  list: Array<{
    id: string;
    order_no: string;
    status: OrderStatus;
    network_time: number;
    customer_id: string;
    customer_name: string;
    customer_region: string;
    customer_region_name: string;
    contact: string | null;
    phone: string | null;
    total_amount: number;           // 全员可见（无脱敏，1.0）
    item_count: number;             // 明细行数
    // payment: 'cash' | 'transfer' | 'credit';  // ⚠️ 1.0 起移除：订单不再有收款方式字段
    payment_status: 'unpaid' | 'pending' | 'paid';   // 收款状态（默认 unpaid）
    received_amount: number;        // 累计实收金额（含 pending/paid 记录）
    has_price_modified: boolean;
    created_by: string;
    created_by_name: string;
    printed: boolean;
    printed_at: number | null;
    ship_large: number | null;       // 实际发货大件数（出库确认时写入），用于已出库列表物流包裹展示
    ship_medium: number | null;      // 实际发货中件数，用于已出库列表物流包裹展示
    ship_small: number | null;       // 实际发货小件数，用于已出库列表物流包裹展示
    remark: string | null;
  }>;
  pagination: { /* ... */ }
}
```

### 6.2 订单详情

- **云函数**：`data-query` / `order-detail`
- **最小权限**：orderer/sorter/warehouse/admin（**全部，完整视图，无价格脱敏与精简视图，1.0**）
- **用途**：返回数据（含 items/amount/payment_status/orderNo/customer/region/phone）用于订单详情、送货单打印与赊销对账（1.0 已取消转发收款卡片）；含 `ship_large`/`ship_medium`/`ship_small` 物流包裹字段（详情显示物流包裹；导出报表/出库单/单订单导出取用）

#### 请求：`{ type:'order-detail', filter:{ _id:'' } }`

#### 返回 data（对象）
```typescript
{
  // 同 6.1 列表所有字段 +（含 payment_status/received_amount 收款状态、ship_large/ship_medium/ship_small 物流包裹；送货单数据同此返回）：
  items_snapshot: Array<{
    seq: number;
    product_id: string;
    sku: string; name: string; spec: string | null;
    pricing_mode: 'case' | 'piece' | 'unit';
    pieces_per_case: number | null;
    piece_qty: number; zero_qty: number;
    unit_price_piece: number;
    unit_price_zero: number;
    original_price: number | null;
    is_price_modified: boolean;
    amount: number;
    remark: string | null;
  }>;
  updated_at: number | null;
  cancelled_at: number | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
}
```

### 6.3 创建订单（含快照）

- **云函数**：`order-write` / `create`
- **最小权限**：orderer/sorter/warehouse/admin（**全员可下单，1.0**）

#### 请求
```typescript
{
  action: 'create',
  payload: {
    customer_id: string;
    contact?: string | null;
    phone?: string | null;
    items: Array<{
      product_id: string;
      piece_qty: number;        // ≥ 0
      zero_qty: number;         // ≥ 0
      // 订单内自定义价格（1.0）：所有商品均可传临时价，仅当前订单有效，不影响商品默认价
      tmp_unit_price_piece?: number;  // ≥ 0，可改价件价（选填，缺省用商品默认价/客户上次价）
      tmp_unit_price_zero?: number;   // ≥ 0，可改价包价（选填）
      remark?: string | null;
    }>;
    // payment?: 'cash' | 'transfer' | 'credit';  // ⚠️ 1.0 起移除：新建订单不再传收款方式
    remark?: string | null;
  }
}
```

| 校验规则 | |
|----------|---|
| items 非空 | 空返回 1001 |
| **价格来源（1.0）** | 传 tmp_ 价 → 用订单内自定义价（写 is_price_modified + original_price_*）；未传 → 取**该客户最近订单成交价**；无历史 → 商品默认价 |
| piece_qty + zero_qty | 至少一个 > 0，否则整条明细被忽略 |
| 计价金额 | 服务端重算，不信任前端 |

| 行为说明 | |
|----------|---|
| usage 自动累计 | 创建成功后自动累计订单内商品 usage 各 +1（服务端累计，每款商品各 +1），用于商品列表常购排序 |

#### 返回 data
```json
{ "order_id": "orders._id", "order_no": "丰淮商贸-20260730-0001", "total_amount": 1234.56 }
```

### 6.4 出库确认 + 分拣动作（update-status）

> 状态流转动作统一收敛到 `update-status`：分拣员**分拣完成**（submitted→sorted，受 `sort:task` 权限控制）；库管**出库确认**（sorted→confirmed，受 `warehouse:confirm` 权限控制，写 ship_* 实际发货件数）；`rejected`（驳回）为二期规划遗留状态，当前流程不触发。

- **云函数**：`order-write` / `update-status`（`confirm` 向后兼容）
- **最小权限**：
  - `sorted → confirmed`（出库确认）：warehouse/admin
  - `submitted → sorted`（分拣完成）：sorter/admin
  - `confirmed → completed`（出库完成/完成）：warehouse/admin
  - `* → cancelled`：admin（带 reason）

#### 请求
```typescript
{
  action: 'update-status',           // 推荐使用；confirm 仍兼容
  payload: {
    id: string;
    target_status: OrderStatus;      // 分拣完成(sorted)/出库确认(confirmed)/完成(completed)/取消(cancelled)；rejected 为二期遗留
    ship_large?: number;    // 出库确认时必填，实际发货大件数，≥ 0
    ship_medium?: number;   // 出库确认时必填，实际发货中件数，≥ 0
    ship_small?: number;    // 出库确认时必填，实际发货小件数，≥ 0
    sort_remark?: string;   // 分拣备注（分拣员分拣完成时可填，如破损/缺货）
    reject_reason?: string; // 【二期规划·当前未启用】原分拣员驳回时必填（长度 5-300）
    cancel_reason?: string; // cancelled 时必填（长度 2-100）
  }
}
```

| 入参 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | ✅ | 订单 ID |
| target_status | OrderStatus | ✅ | 目标状态（出库确认传 confirmed / 分拣完成传 sorted / 完成传 completed） |
| ship_large | number | 出库确认时必填 | 实际发货大件数，≥ 0；作为物流包裹展示与导出 |
| ship_medium | number | 出库确认时必填 | 实际发货中件数，≥ 0；作为物流包裹展示与导出 |
| ship_small | number | 出库确认时必填 | 实际发货小件数，≥ 0；作为物流包裹展示与导出 |
| sort_remark | string | 否 | 分拣备注 |
| reject_reason | string | 【二期】驳回时必填 | 【二期规划·当前未启用】驳回原因（5-300字） |
| cancel_reason | string | cancelled 时必填 | 取消原因（长度 2-100） |

| 合法状态流转 | |
|---|---|
| draft → submitted | 已提交（待分拣） |
| **submitted → sorted** | **分拣员分拣完成（写 sort_remark，受 `sort:task`）** |
| **sorted → confirmed** | **库管出库确认（受 `warehouse:confirm`），记录 ship_large/ship_medium/ship_small** |
| confirmed → completed | 出库完成/完成 |
| * → cancelled | 管理员取消 |
| **submitted → rejected（二期）** | **【二期规划·当前未启用】原分拣员驳回（必填 reject_reason）→ 下单员修改重提** |
| 其他跳转 | 返回 3002 |

#### 返回：`{ id, status, ship_large, ship_medium, ship_small, sorter_hint: 'not_sorted_yet' | 'already_sorted' | null, updated:true }`

### 6.5 库管并行配货暂存（二期规划·当前未启用）

- **云函数**：`order-write` / `pick-stash`
- **最小权限**：warehouse/admin
- **说明**：【二期规划·当前未启用】原对**已提交（submitted）**订单录入大/中/小件配货数；支持多库管**并行**配货（可同时操作不同订单）；**不改变订单状态**。当前 MVP 简化为库管一步出库确认（已分拣→已出库），无需暂存配货，本接口暂不启用。

#### 请求
```typescript
{
  action: 'pick-stash',
  payload: {
    id: string;
    pick_large: number;    // 大件配货数，≥ 0
    pick_medium: number;   // 中件配货数，≥ 0
    pick_small: number;    // 小件配货数，≥ 0
  }
}
```

| 校验规则 | |
|----------|---|
| 仅 submitted | 【二期】非 submitted 状态返回 3002 |
| 可重复调用 | 【二期】多次调用覆盖更新配货数，不产生状态变更 |

#### 返回：`{ id, pick_large, pick_medium, pick_small, updated:true }`

### 6.6 标记已打印

- **云函数**：`order-write` / `mark-printed`
- **最小权限**：orderer/sorter/warehouse/admin（全员可蓝牙打印，1.0）

#### 请求：`{ action:'mark-printed', payload:{ id } }`

#### 返回：`{ id, printed:true, printed_at }`

### 6.7 收款登记（第 1 步：登记，1.0）

- **云函数**：`order-write` / `collect`
- **最小权限**：orderer/sorter/admin（登记收款；1.0 放开分拣员）
- **说明**：下单员/分拣员登记收款（**以商家到账为准**），生成一条 `status=pending`（待确认）收款记录，订单 `payment_status=unpaid→pending`。一笔订单可多次登记（部分收款累计）；登记可选填**折价/货损金额（collect_discount）**记录实收与应付差额（如100元货品实收90元，折价10元）。

#### 请求
```typescript
{
  action: 'collect',
  payload: {
    id: string;
    method?: 'cash' | 'wechat';  // 收款渠道（现金/微信，台账"现余/微信"拆分用；默认 cash）
    collect_amount: number;    // 实收金额，≥ 0，以商家到账为准
    collect_discount: number;  // 折价/货损金额，≥ 0，默认 0（可选）
    collect_time: number;      // 收款时间（毫秒时间戳）
  }
}
```

| 入参 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | ✅ | 订单 ID |
| method | 'cash'\|'wechat' | ❌ | 收款渠道（现金/微信，台账"现余/微信"拆分用；默认 `cash`） |
| collect_amount | number | ✅ | 实收金额，≥ 0 |
| collect_discount | number | ❌ | 折价/货损金额，≥ 0，默认 0 |
| collect_time | number | ✅ | 收款时间（毫秒时间戳） |

#### 返回 data
```typescript
{
  id: string;
  payment: {
    payment_id: string;
    status: 'pending';                 // 待库管确认
    amount: number;
    discount: number;                  // 折价/货损金额，默认 0
    registered_by: string;             // 登记人（服务端记录当前操作者）
    registered_at: number;
  };
  payment_status: 'pending';
  received_amount: number;
  updated: true;
}
```

> 登记人（registered_by）由服务端记录当前操作者，前端不可传。登记后需库管调 6.8 确认收款，收款流程才算完成。

### 6.8 确认收款（第 2 步：库管确认，1.0）

- **云函数**：`order-write` / `collect-confirm`
- **最小权限**：warehouse/admin（确认收款，收款流程最后一步）
- **说明**：库管对已登记（pending）的收款记录点【确认收款】→ 记录 `status=pending→confirmed`，订单 `payment_status=pending→paid`；支持按订单确认（传入 order_id 自动确认该订单全部 pending 记录）。

#### 请求
```typescript
{
  action: 'collect-confirm',
  payload: {
    id?: string;               // 订单 ID；确认该订单全部待确认收款记录
    payment_id?: string;       // 或指定单条收款记录 ID（二选一）
  }
}
```

| 入参 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 二选一 | 订单 ID，确认该订单全部 pending 记录 |
| payment_id | string | 二选一 | 单条收款记录 ID |

#### 返回 data
```typescript
{
  payment_ids: string[];
  payment_status: 'paid' | 'pending';   // 全部结清=paid；仍有剩余欠款=pending
  received_amount: number;              // 累计实收（含本批确认）
  total_discount: number;               // 累计折价/货损（已确认记录之和）
  remaining_debt: number;               // 剩余欠款 = total_amount - received_amount - total_discount
  confirmed_by: string;                 // 确认人（库管，服务端记录）
  confirmed_at: number;
  updated: true;
}
```

### 6.9 修改订单备注

- **云函数**：`order-write` / `update-remark`
- **最小权限**：orderer/sorter/warehouse/admin（**全员可随时修改备注，1.0**）
- **说明**：全员可**随时**修改订单备注，不限制订单状态。

#### 请求
```typescript
{
  action: 'update-remark',
  payload: {
    id: string;
    remark: string | null;   // 新备注；传 null 清空
  }
}
```

#### 返回：`{ id, remark, updated:true }`

### 6.10 赊销（三栏：客户台账/未结清/已结清 + 收款确认，1.0 已收口径）

- **云函数**：`data-query` / `receivable`
- **最小权限**：orderer/sorter/warehouse/admin（**全员可见，1.0**）
- **说明**：赊销页数据源（三栏：📋客户台账 / 📌未结清 / ✅已结清，外加独立「✅ 收款确认」按钮）。以客户为单位展示总账 = **应收总额 / 已收(received) / 未结清**（金额守恒：应收 = 已收 + 未结清），台账/汇总/导出三处统一「已收」口径（替代原「已结清」仅完全结清口径）；支持周期选择（全部/今日/本周/本月/自定义）。所有订单默认未收款（unpaid）；账期可跨数月。

#### 请求
```typescript
{
  type: 'receivable',
  filter: {
    region?: string;          // 区域筛选
    keyword?: string;         // 客户名/电话搜索
    period?: 'all' | 'today' | 'week' | 'month' | 'custom';  // 周期选择（默认 all）
    date_from?: number;       // 自定义周期起（毫秒时间戳）
    date_to?: number;
    tab?: 'ledger' | 'unsettled' | 'settled';  // 三栏：客户台账/未结清/已结清
  },
  page?: number;
  page_size?: number;
}
```

#### 返回 data (list)
```typescript
{
  list: Array<{
    customer_id: string;
    customer_name: string;
    customer_region: string;
    receivable_total: number;          // 应收总额（该客户所有订单金额合计）
    received: number;                  // 已收（含部分收款/折价，received 口径，= Σ received_amount + Σ 已确认折扣减免）
    unsettled: number;                 // 未结清 = 应收总额 − 已收（金额守恒）
    settled: boolean;                  // 是否已结清（unsettled === 0）
    unpaid_orders: number;             // 未收款订单数
    pending_orders: number;            // 待确认收款订单数
    paid_orders: number;               // 已结清订单数
  }>;
  pagination: { /* ... */ }
}
```

> 赊销页交互（1.0 三栏 + 已收口径）：下单员/分拣员（受 `receivable:collect`）对订单【登记收款】（6.7），库管（受 `receivable:confirm`）对客户卡片/订单【确认收款】（6.8）；已收实时累加。**未结清 = 应收总额 − 已收(received) − Σ(已确认收款记录 discount)**；台账/汇总/导出的「已收」统一口径，不再使用「累计总欠款 / 每日欠款明细」旧描述。1.0 已取消商户收款码与转发收款卡片。

---

## 7. 用户相关

### 7.1 用户列表

- **云函数**：`data-query` / `users`
- **最小权限**：admin

#### 请求：`{ type:'users', filter:{ role:'', status:'' }, page:1, page_size:20 }`

#### 返回 data (list)
```typescript
{
  list: Array<{
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'orderer' | 'sorter' | 'warehouse';
    avatar: string | null;
    phone: string | null;
    region: string | null;
    region_name: string | null;
    status: 'active' | 'inactive';
    created_at: number;
  }>;
  pagination: { /* ... */ }
}
```

> ⚠️ 绝不返回 `wx_openid`、`invitedBy` 等敏感字段；响应仅含脱敏后的展示信息。

### 7.2 新增用户

- **云函数**：`user-write` / `create`
- **最小权限**：admin
- **首管理员（方案 A 零配置）**：首管理员**无需通过 `user-write` 预置**——系统首次启动无 admin 时，`auth-login` 自动把第一位登录者赋为 `role=admin`（见 §2.1）。`user-write` 仅用于管理员新增普通成员（orderer/sorter/warehouse/admin）。环境变量 `ADMIN_OPENID` 预置首管理员 openid 仅作**可选兜底（方式二）**。

#### 请求
```typescript
{
  action: 'create',
  payload: {
    username?: string;      // 已废弃：微信原生无用户名
    name: string;           // 2-30
    password?: string;      // 已废弃：微信原生无密码
    role: 'orderer' | 'sorter' | 'warehouse' | 'admin';
    phone?: string | null;
    region?: string | null;
    avatar?: string | null;
    status?: 'pending' | 'active' | 'disabled';
  }
}
```

#### 返回：`{ id, inviteCode }`  // inviteCode 供「成员管理」生成邀请二维码

### 7.3 修改用户

- **云函数**：`user-write` / `update`
- **最小权限**：admin

#### 请求
```typescript
{
  action: 'update',
  payload: {
    id: string;
    // 以下可选：name / role / phone / region / status（微信原生无 password，重置密码不适用）
  }
}
```

> 传 `status: 'disabled'` 可停用账号；传 `role` 可改角色；其余字段按需更新。

#### 返回：`{ id, updated:true }`

---

## 7A. 智能录入相关

#### 7A.1 智能匹配（smart.match）

**调用方式**：`wx.cloud.callFunction({ name: 'smart', data: { action: 'match', ... } })`

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| action | string | ✅ | 固定 "match" |
| text | string | ✅ | 用户输入的自然语言文本 |
| mode | string | ❌ | "text"（默认）或 "voice" |

**返回**：
```json
{
  "code": 0,
  "data": {
    "customer": { "_id": "xxx", "name": "东一路刀削面", "score": 0.95 } | null,
    "customerCandidates": [],
    "items": [
      {
        "inputText": "手抓饼",
        "matched": { "_id": "xxx", "name": "葱香手抓饼", "material_code": "SP001", "spec": "100g*20片", "unit_piece_qty": 20, "score": 0.85 },
        "candidates": [],
        "qty": { "piece_qty": 2, "bag_qty": 0 }
      }
    ],
    "unmatched": ["未知商品"]
  }
}
```

| 错误码 | 说明 |
|--------|------|
| 5001 | text 参数为空 |
| 5002 | 无匹配结果 |

#### 7A.2 语音转文字（smart.transcribe）

**调用方式**：`wx.cloud.callFunction({ name: 'smart', data: { action: 'transcribe', ... } })`

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| action | string | ✅ | 固定 "transcribe" |
| audioFileID | string | ✅ | 云存储中的音频文件 ID |

**返回**：
```json
{
  "code": 0,
  "data": {
    "text": "送2件手抓饼给东一路刀削面"
  }
}
```

---

## 8. 接口状态矩阵

| 接口 | orderer | sorter | warehouse | admin |
|------|---------|--------|-----------|-------|
| 2.1 登录 | ✅ 小程序 | ✅ 小程序 | ✅ 小程序 | ✅ 小程序 |
| 3.1 商品列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 3.2 商品详情 | ✅ | ✅ | ✅ | ✅ |
| 3.3 新增商品 | ✅ 本人 | ❌ | ❌ | ✅ 全部 |
| 3.4 修改商品 | ✅ 本人 | ❌ | ❌ | ✅ 全部 |
| 4.1 客户列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 4.3 新增客户 | ✅ 本人 | ❌ | ❌ | ✅ 全部 |
| 5.1 区域列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 5.2/3 区域写 | ❌ | ❌ | ❌ | ✅ |
| 6.1 订单列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 6.2 订单详情 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 6.3 创建订单 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 6.4 submitted→sorted（分拣完成） | ❌ | ✅ | ❌ | ✅ |
| 6.4 submitted→rejected（驳回，二期） | ❌ | ❌（二期未启用） | ❌ | ❌（二期未启用） |
| 6.4 sorted→confirmed（出库确认） | ❌ | ❌ | ✅ | ✅ |
| 6.4 confirmed→completed（出库完成） | ❌ | ❌ | ✅ | ✅ |
| 6.4 *→cancelled（取消） | ❌ | ❌ | ❌ | ✅ 含取消 |
| 6.5 配货暂存（二期·未启用） | ❌ | ❌ | ❌（二期） | ❌（二期） |
| 6.6 标记已打印 | ✅ 全部（蓝牙） | ✅ 全部（蓝牙） | ✅ 全部（蓝牙） | ✅ 全部 |
| 6.7 收款登记（receivable:collect） | ✅ 全部 | ✅ 全部 | ❌ | ✅ |
| 6.8 确认收款（receivable:confirm） | ❌ | ❌ | ✅ | ✅ |
| 6.9 修改备注 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 6.10 赊销（三栏+已收） | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 7.x 用户管理 | ❌ | ❌ | ❌ | ✅ |
| 7A.1 智能匹配 | ✅ 全员 | ✅ 全员 | ✅ 全员 | ✅ 全员 |
| 7A.2 语音转文字 | ✅ 全员 | ✅ 全员 | ✅ 全员 | ✅ 全员 |

> **细粒度权限键（1.0）**：上表为角色级默认权限（默认全员开放）。在角色之上提供可开关的权限键，管理员可在「成员管理 → 权限配置」中按需关闭，关闭后对应 Tab/功能运行时自动隐藏：
> - `sort:task`：处理分拣（6.4 submitted→sorted），控制分拣员「分拣完成」；
> - `warehouse:confirm`：出库确认（6.4 sorted→confirmed），控制库管「出库确认」；
> - `receivable:collect`：登记收款（6.7），下单员/分拣员可，库管不可；
> - `receivable:confirm`：确认收款（6.8），库管可，下单员/分拣员不可。
> 首管理员由 `auth-login` 方案 A 零配置自动赋值（见 §2.1），无需通过 `user-write` 预置。

---

## 9. FAQ

| Q | A |
|---|---|
| Web 后台导出 Excel 走哪个接口？ | 走 6.1 订单列表 `page_size=10000` 拉全量，纯前端 SheetJS 生成 .xlsx，**不再单独写云函数接口** |
| 订单取消怎么处理？ | 6.4 `update-status` 传 `*→cancelled`，仅 admin，需传 cancel_reason |
| 订单可修改明细吗？ | 全员可改单：编辑订单（改后状态回退）；已提交后可取消 + 重新下单 |
| 订单内自定义价格生效范围？ | 1.0 所有商品均可改价，仅对当前订单有效（6.3 tmp_ 价）；不影响商品默认价与其他订单 |
| 客户下单价格默认值怎么取？ | 6.3 未传 tmp_ 价时，取该客户最近订单成交价；无历史则用商品默认价 |
| 蓝牙打印失败后能重打吗？ | 可以：详情页"重新打印" → 调 6.6 标记已打印 + 走蓝牙打印 |
| 订单备注能改吗？ | 可以：全员随时调 6.9 `update-remark` 修改/清空备注，不限订单状态 |
| 收款流程是什么？ | 两步：6.7 下单员/分拣员【登记收款】(→pending) → 6.8 库管【确认收款】(→paid)；现金/转账/赊账统一 |
| 赊销欠款怎么查？ | 6.10 `receivable` 赊销页三栏（📋客户台账 / 📌未结清 / ✅已结清）+ 独立「收款确认」按钮；以客户为单位展示 **应收总额 / 已收(received) / 未结清**（金额守恒：应收 = 已收 + 未结清），统一「已收」口径 |
| 商户收款码还有吗？ | **1.0 已取消**：无任何收款码/259号文内容，收款仅做内部登记→库管确认 |
| 是否有操作日志接口？ | v1.0 极简版**砍掉**，不加操作审计日志独立接口 |

---

## 附录 A：订单号格式与示例

| 字段 | 示例 |
|------|------|
| 订单号格式 | `丰淮商贸-YYYYMMDD-NNNN` |
| 示例 | `丰淮商贸-20260730-0001` |
| 唯一性 | 4 位 NNNN 按日从 0001 递增；最大日单量 9999；超量报错并告警 |
| 时间戳用哪个？ | `network_time`（服务端写入 orders.network_time），不信任前端时间 |

## 附录 B：分页默认值

| 字段 | 默认值 |
|------|--------|
| page | 1 |
| page_size | 20（订单/商品/客户），用户 20，区域不分页 |
| 最大 page_size | 10000（用于 Excel 导出一次性拉取） |

## 附录 C：版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-07-28 | 初版发布（方案A：50+接口，30+云函数） |
| **1.0** | **2026-07-30** | **方案B（极简版）：砍至 8 个云函数 + 20 个 action；Excel 导出改前端 SheetJS 不再设云函数接口；取消所有操作日志/价格变更/继承日志接口；角色权限矩阵精简** |
| **1.0** | **2026-08-03** | **新增 3 个接口：6.5 配货暂存（pick-stash）、6.7 收款登记（collect）、6.8 修改备注（update-remark），共 23 个 action；订单号前缀改为"丰淮商贸-"；订单状态 submitted→待发货、checked→已发货；"确认订单"升级为 6.4"配完"（submitted/checked 两态均可直接调用，无需等分拣确认，新增 ship_large/ship_medium/ship_small）；商品列表新增 usage 字段并支持按使用频率降序；订单列表/详情对库管价格脱敏、新增 collect 收款状态字段（列表/详情/送货单）；分拣员动作："确认已发货/驳回"，取消校对环节 |
| **1.0** | **2026-08-04** | **赊销收款管理版（对齐产品 1.0）：①新增 2 接口：6.10 赊销看板（receivable，客户维度每日欠款+累计总欠款）、6.8 确认收款（collect-confirm），共 25 个 action；②收款改两步：6.7 下单员/分拣员登记(→pending) → 6.8 库管确认(→paid)，登记可填折价/货损（collect_discount）；③下单/改单/删单全员权限：6.3 创建订单放开至 4 角色，订单列表/详情取消价格脱敏与精简视图（全员完整视图）；④6.3 所有商品可订单内自定义价格（tmp_ 价，仅当前订单有效），未传价时默认取客户上次成交价；⑤6.9 修改备注全员可用；⑥6.6 标记已打印全员可用；⑦订单列表/详情字段 collect → payment_status/received_amount；⑧sorter 角色补入登录/用户接口 role 枚举与状态矩阵；⑨取消商户收款码与259号文合规内容（转发收款卡片下线） |

---

> **文档结束**  
> 如发现接口契约不匹配，请优先修改调用方代码，并在版本历史补充记录。