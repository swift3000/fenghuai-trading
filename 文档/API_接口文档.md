# 丰淮商贸采购下单助手 — 接口文档（API）

> **文档版本**：v2.0（方案B）  
> **编写日期**：2026-07-30  
> **状态**：已定稿  
> **总接口数**：20 个（方案B极简版，砍到 20 个闭环）  
> **调用方式**：微信云函数（`wx.cloud.callFunction`）
> **工期**：3周  
> **预算**：5,000元

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

### 1.2 云函数与 Action 对照表（仅 8 个云函数，20 个 action）

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
| 10 | product-write | create | 新增商品 |
| 11 | | update | 修改商品 |
| 12 | customer-write | create | 新增客户 |
| 13 | | update | 修改客户 |
| 14 | order-write | create | 创建订单 |
| 15 | | update-status | 更新订单状态 |
| 16 | | mark-printed | 标记已打印 |
| 17 | region-write | create | 新增区域 |
| 18 | | update | 修改区域 |
| 19 | user-write | create | 新增用户 |
| 20 | | update | 修改用户 |

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
| | submitted | 待确认 |
| | confirmed | 已确认 |
| | cancelled | 已取消 |
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

#### 请求
```typescript
// auth-login 的 event 格式直接为 payload
{
  // 小程序端：不传，云函数内部通过 getWXContext().OPENID 直接拿身份
  // Web 后台端：用户名密码
  username?: string;   // Web 后台用
  password?: string;   // Web 后台用
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
    role: 'admin' | 'orderer' | 'warehouse';
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
- **最小权限**：orderer/warehouse/admin

#### 请求
```typescript
{
  type: 'products',
  filter?: {
    keyword?: string;
    category?: string;
    status?: 'active' | 'inactive';
  },
  page?: number;
  page_size?: number;
  sort?: { [key: string]: 1 | -1 }
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
    status: 'active' | 'inactive';
    created_by_name: string; created_at: number;
  }>;
  pagination: { page: number; page_size: number; total: number; total_pages: number; }
}
```

### 3.2 商品详情

- **云函数**：`data-query` / `product-detail`
- **最小权限**：orderer/admin

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
    status?: 'active' | 'inactive';  // 默认 active
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
    status?: 'active' | 'inactive';
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
- **最小权限**：orderer（本人）/warehouse/admin（全部）

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
    total_amount: number;
    item_count: number;             // 明细行数
    payment: 'cash' | 'transfer' | 'credit';
    has_price_modified: boolean;
    created_by: string;
    created_by_name: string;
    printed: boolean;
    printed_at: number | null;
    remark: string | null;
  }>;
  pagination: { /* ... */ }
}
```

### 6.2 订单详情

- **云函数**：`data-query` / `order-detail`
- **最小权限**：orderer（本人）/warehouse/admin（全部）

#### 请求：`{ type:'order-detail', filter:{ _id:'' } }`

#### 返回 data（对象）
```typescript
{
  // 同 6.1 列表所有字段 +：
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
- **最小权限**：orderer/admin

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
      // 普通商品不允许传价格，后端自动快照
      // 可调价商品（93 SKU或客户可调价）时，前端可临时传：
      tmp_unit_price_piece?: number;  // ≥ 0，仅 93 / adjustable 生效
      tmp_unit_price_zero?: number;   // ≥ 0，仅 93 / adjustable 生效
      remark?: string | null;
    }>;
    payment?: 'cash' | 'transfer' | 'credit';  // 默认 cash
    remark?: string | null;
  }
}
```

| 校验规则 | |
|----------|---|
| items 非空 | 空返回 1001 |
| price 生效范围 | 非 93 / 非客户 adjustable 的 tmp_ 价被忽略，自动取商品价 |
| piece_qty + zero_qty | 至少一个 > 0，否则整条明细被忽略 |
| 计价金额 | 服务端重算，不信任前端 |

#### 返回 data
```json
{ "order_id": "orders._id", "order_no": "FH-20260730-0001", "total_amount": 1234.56 }
```

### 6.4 更新订单状态

- **云函数**：`order-write` / `update-status`
- **最小权限**：
  - `submitted → confirmed`：warehouse/admin
  - `confirmed → cancelled`：admin（带 reason）
  - `* → cancelled`：admin

#### 请求
```typescript
{
  action: 'update-status',
  payload: {
    id: string;
    target_status: OrderStatus;
    cancel_reason?: string;   // cancelled 时必填（长度 2-100）
  }
}
```

| 合法状态流转 | |
|---|---|
| draft → submitted | 已提交（待确认） |
| submitted → confirmed | 已确认（打印发货） |
| * → cancelled | 管理员取消 |
| 其他跳转 | 返回 3002 |

#### 返回：`{ id, status, updated:true }`

### 6.5 标记已打印

- **云函数**：`order-write` / `mark-printed`
- **最小权限**：warehouse/admin

#### 请求：`{ action:'mark-printed', payload:{ id } }`

#### 返回：`{ id, printed:true, printed_at }`

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
    role: 'admin' | 'orderer' | 'warehouse';
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

> ⚠️ 绝不返回 `password_hash`、`wx_openid`。

### 7.2 新增用户

- **云函数**：`user-write` / `create`
- **最小权限**：admin

#### 请求
```typescript
{
  action: 'create',
  payload: {
    username: string;       // 3-50 字母数字下划线，唯一
    name: string;           // 2-30
    password: string;       // 6-128（云函数内 bcrypt 哈希）
    role: 'orderer' | 'warehouse' | 'admin';
    phone?: string | null;
    region?: string | null;
    avatar?: string | null;
    status?: 'active' | 'inactive';
  }
}
```

#### 返回：`{ id, username }`

### 7.3 修改用户

- **云函数**：`user-write` / `update`
- **最小权限**：admin

#### 请求
```typescript
{
  action: 'update',
  payload: {
    id: string;
    // 以下可选：name / password / role / phone / region / avatar / status
  }
}
```

> 传 `password` 时才重置密码；否则不修改。

#### 返回：`{ id, updated:true }`

---

## 8. 接口状态矩阵

| 接口 | orderer | warehouse | admin |
|------|---------|-----------|-------|
| 2.1 登录 | ✅ 小程序 | ✅ 小程序/Web | ✅ Web |
| 3.1 商品列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 3.2 商品详情 | ✅ | ✅ | ✅ |
| 3.3 新增商品 | ✅ 本人创建/修改/停用 | ❌ | ✅ |
| 3.4 修改商品 | ✅ 本人创建/修改/停用 | ❌ | ✅ 全部 |
| 4.1 客户列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 4.3 新增客户 | ✅ 本人创建/修改/停用 | ❌ | ✅ 全部 |
| 5.1 区域列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 5.2/3 区域写 | ❌ | ❌ | ✅ |
| 6.1 订单列表 | ✅ 本人 | ✅ 全部 | ✅ 全部 |
| 6.2 订单详情 | ✅ 本人含价格 | ✅ 全部含价格（导出） | ✅ 全部 |
| 6.3 创建订单 | ✅ 本人 | ❌ | ✅ 模拟 |
| 6.4 submitted→confirmed | ❌ | ✅ | ✅ |
| 6.4 confirmed→* | ❌ | ❌ | ✅ 含取消 |
| 6.5 标记已打印 | ✅ 本人（蓝牙） | ✅ 全部（后台） | ✅ |
| 7.x 用户管理 | ❌ | ❌ | ✅ |

---

## 9. FAQ

| Q | A |
|---|---|
| Web 后台导出 Excel 走哪个接口？ | 走 6.1 订单列表 `page_size=10000` 拉全量，纯前端 SheetJS 生成 .xlsx，**不再单独写云函数接口** |
| 订单取消怎么处理？ | 6.4 `update-status`，仅 admin，需传 cancel_reason |
| 订单可修改明细吗？ | v1.0 不支持改明细，只能"取消订单" + 重新下单 |
| 客户可调价的校验点在哪？ | `customers.is_adjustable=true` 或 SKU 以 93 开头，前端 tmp_ 临时价才生效；否则被服务端以商品原价覆盖 |
| 蓝牙打印失败后能重打吗？ | 可以：详情页"重新打印" → 调 6.5 标记已打印 + 走蓝牙打印/后台打印 |
| 是否有操作日志接口？ | v1.0 极简版**砍掉**，不加操作审计日志独立接口 |

---

## 附录 A：订单号格式与示例

| 字段 | 示例 |
|------|------|
| 订单号格式 | `FH-YYYYMMDD-NNNN` |
| 示例 | `FH-20260730-0001` |
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
| **v2.0** | **2026-07-30** | **方案B（极简版）：砍至 8 个云函数 + 20 个 action；Excel 导出改前端 SheetJS 不再设云函数接口；取消所有操作日志/价格变更/继承日志接口；角色权限矩阵精简** |

---

> **文档结束**  
> 如发现接口契约不匹配，请优先修改调用方代码，并在版本历史补充记录。