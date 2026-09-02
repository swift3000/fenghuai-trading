# 乾多多采购下单助手 — 接口文档（API）

> **文档版本**：MVP v1.0（2026-08-05 定稿，最终功能范围）
> **编写日期**：2026-08-03  
> **最后更新**：2026-08-04  
> **状态**：已定稿  
> **总接口数**：80 个 action（13 个云函数；机器可读口径以 docs/api/openapi.yaml 为准，2026-09-02 T62 按源码逐条对账全量重生成；含「智能匹配 smart.match」「语音转文字 smart.transcribe」）  
> **调用方式**：微信云函数（`wx.cloud.callFunction`）
> **MVP 口径**：本文档已按 MVP（v1.0，2026-08-05）修订，MVP 为最终功能范围，无二期增强；接口契约以《小程序 MVP 落地计划与技术架构》为准。
> **工期**：约 33 人天（MVP 生产化，详见《工期与工作量评估》）

---

## 1. 通用约定

### 1.1 调用方式

小程序端：
```javascript
wx.cloud.callFunction({
  name: 'orders',
  data: { action: 'create', payload: { /* ... */ } },
  success: res => { /* res.result = { code, message, data } */ }
});
```

Web 后台端（云开发静态托管同源时用 tcb-js-sdk）：
```javascript
const app = tcb.init({ env: ENV_ID });
const res = await app.callFunction({
  name: 'orders',
  data: { action: 'create', payload: { /* ... */ }, __auth: token }
});
```

### 1.2 云函数与 Action 对照表（13 个云函数，80 个 action）

| # | 云函数 | Action | 接口名 |
|---|--------|--------|--------|
| 1 | auth | — | 用户登录 |
| 2 | products | products | 商品列表 |
| 3 | | product-detail | 商品详情 |
| 4 | | create | 新增商品 |
| 5 | | update | 修改商品 |
| 6 | customers | customers | 客户列表 |
| 7 | | customer-detail | 客户详情 |
| 8 | | create | 新增客户 |
| 9 | | update | 修改客户 |
| 10 | regions | regions | 区域列表 |
| 11 | | create | 新增区域 |
| 12 | | update | 修改区域 |
| 13 | orders | orders | 订单列表 |
| 14 | | order-detail | 订单详情 |
| 15 | | create | 创建订单 |
| 16 | | update-status | 更新订单状态（分拣完成/出库确认/完成/取消；驳回为二期遗留） |
| 17 | | pick-stash | 配货暂存（二期规划·当前未启用） |
| 18 | receivable | collect | 收款登记（第 1 步：下单员/分拣员，receivable 云函数） |
| 19 | | confirmPayment | 确认收款（第 2 步：库管，receivable 云函数） |
| 20 | | update-remark | 修改订单备注 |
| 21 | | mark-printed | 标记已打印 |
| 22 | users | users | 用户列表 |
| 23 | | create | 新增用户 |
| 24 | | update | 修改用户 |
| 25 | | dashboard | 赊销三栏：客户台账/未结清/已结清（已收口径；另含 customerDetail/paymentHistory/pendingConfirm/exportReceivable） |
| 26 | system | getAiConfig | 获取 AI 服务配置（腾讯云语音 + TokenHub NLP） |
| 27 | | updateAiConfig | 更新 AI 服务配置（仅管理员） |
| 28 | smart | match | 智能匹配（商品/客户模糊匹配） |
| 29 | | transcribe | 语音转文字 |
| 30 | report | summary | 报表统计（商品汇总/客户汇总/收款台账） |
| 31 | | export | 报表导出（Excel/CSV） |
| 32 | outbound | pendingSortList | 待分拣列表（T62 补文档） |
| 33 | | pendingOutList | 待出库列表（T62 补文档） |
| 34 | | confirmSort | 确认分拣（T62 补文档） |
| 35 | | confirmOut | 确认出库（T62 补文档） |
| 36 | | exportOutbound | 出库导出（T62 补文档） |
| 37 | import-data | import-customers | 客户数据导入（admin 运维，T62 补文档） |
| 38 | | import-products | 商品数据导入（admin 运维，T62 补文档） |
| 39 | | import-all | 全量导入（admin 运维，T62 补文档） |
| 40 | | verify | 导入校验（admin 运维，T62 补文档） |
| 41 | sync-data | sync-customers | 客户数据同步（admin 运维，T62 补文档） |
| 42 | | sync-products | 商品数据同步（admin 运维，T62 补文档） |
| 43 | | sync-all | 全量同步（admin 运维，T62 补文档） |

> 实际项目共 13 个云函数：auth、products、customers、orders、users、regions、receivable、system、smart、report、outbound、import-data、sync-data；另含工具函数 init-db、check-customer-fields、clear-all-data（仅手动运维调用，不纳入上表）。完整 action 清单与参数契约以 docs/api/openapi.yaml 为准（80 paths，2026-09-02 T62-A7 补齐 12 个漏文档 action）。

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
| 1001 | 参数错误：xxx | 前端校验补齐参数（新接口参数校验统一用 1001） |
| 1002 | 未登录或登录已失效 | 跳登录页 |
| 2001 | 无权限执行该操作 | 提示并禁止（历史兼容：orders 的 0 元订单/空商品校验早期沿用了 2001，前端仅展示 message，行为不受影响；新接口一律用 1001） |
| 2002 | 数据不存在 | 提示用户或刷新 |
| 2003 | 账户已禁用 | 提示联系管理员 |
| 3002 | 当前订单状态不允许此操作 | 前端按钮 disabled |
| 4001 | 参数缺失/为空（客户名/商品名/customerId 等） | 前端校验补齐参数 |
| 4002 | 收款金额超过剩余欠款 | 前端金额校验，提示用户 |
| 4004 | 资源不存在（订单/客户/商品） | 提示用户或刷新列表 |
| 5001 | 服务器内部错误 | 稍后重试或联系技术 |
| 5002 | 智能录入 text 参数为空 | 前端校验补齐参数 |
| 5003 | 暂无商品数据（智能匹配无候选） | 提示用户先维护商品库 |

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

- **云函数**：`auth`
- **最小权限**：公开
- **首管理员（方案 A 零配置）**：系统首次启动无任何管理员时，`auth` 云函数检测到「当前无 admin」即把**第一位登录者自动赋值为 `role=admin`**（无需预置任何环境变量、也无需先知道 openid）。老板部署后直接用微信打开小程序登录即可，无需配置 `ADMIN_OPENID` 等。预置首管理员 openid（环境变量 `ADMIN_OPENID`）仅作为**可选兜底（方式二）**，主路径为方案 A 零配置。

#### 请求
```typescript
// auth 的 event 格式直接为 payload
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

### 2.2 生成邀请码（成员邀请，管理员专用）

- **云函数**：`auth` / `getInviteCode`
- **最小权限**：admin
- **说明**：管理员在「成员管理」选择角色后调用，后端按预设角色自动创建一个「待激活（pending）」用户并生成 **6 位邀请码（7 天有效）+ 邀请小程序码**。员工可扫码进入登录页（自动带出邀请码）或在登录页手动填写邀请码，一键登录即自动绑定 openid 并激活为该预设角色（见 §2.1），无需管理员再手动分配。
- **小程序码**：`wxacode.getUnlimited` 生成，`scene = invite=<inviteCode>`，`page = pages/login/login`，上传云存储，`inviteQr` 字段返回 fileID 供成员管理展示（auth 云函数 `config.json` 已声明 `wxacode.getUnlimited` 权限）。

#### 请求
```typescript
// auth 的 event 格式直接为 payload
{
  action: 'getInviteCode',
  role: 'orderer' | 'sorter' | 'warehouse' | 'admin';  // 预设角色
  name?: string;
  phone?: string;
  region?: string;
}
```

#### 返回 data
```typescript
{
  userId: string;      // 新建待激活用户的 _id
  inviteCode: string;  // 6 位邀请码
  expireTime: Date;    // 有效期（7 天后）
  role: string;        // 预设角色
  qrFileID: string | null;  // 邀请小程序码 fileID（云存储，供成员管理 <image> 展示）
}
```

#### 失败示例
```json
{ "code": 403, "message": "无权生成邀请码" }
```

---

## 3. 商品相关

### 3.1 商品列表

- **云函数**：`products`
- **Action**：`products`
- **最小权限**：orderer/sorter/warehouse/admin（商品列表全员可见）

#### 请求
```typescript
{
  type: 'products',
  filter?: {
    keyword?: string    // 模糊搜索（商品名/商品料号 material_code）
  },
  page?: number;
  page_size?: number
}
```

> 说明：商品列表无客户维度常购排序、无 usage 字段（MVP 实际实现）；全量返回 + 前端本地过滤。

#### 返回 data (list)
```typescript
{
  list: Array<{
    id: string;
    material_code: string;      // 商品料号（唯一标识展示位；93 开头=调货品，is_adjustable=true 可改价）
    name: string;
    spec: string | null;        // 规格，如 1×60
    unit: string;               // 单位（包）
    pricing_mode: 'case' | 'piece' | 'unit';
    unit_piece_qty: number;     // 每箱件数（case 模式）
    price_piece: number | null; // 件价（箱价/件）
    price_unit: number | null;  // 单件零售价
    pinyin: string;             // 拼音（智能录入辅助）
    is_adjustable: boolean;     // 是否允许改价
  }>
}
```

### 3.2 商品详情

- **云函数**：`products` / `product-detail`
- **最小权限**：orderer/sorter/warehouse/admin（全员可见）

#### 请求
```json
{ "type": "product-detail", "filter": { "_id": "商品ID" } }
```

#### 返回 data（对象）：同 3.1 列表的单条对象字段（含全部字段，无 list 包裹）。

### 3.3 新增商品

- **云函数**：`products`
- **Action**：`create`
- **最小权限**：orderer/sorter/warehouse/admin（**商品管理全角色 CRUD，1.0**）

#### 请求
```typescript
{
  action: 'create',
  payload: {
    name: string;               // 必填，商品名称
    material_code?: string;     // 商品料号（选填，默认空串）
    spec?: string;              // 规格，选填
    unit?: string;              // 单位，选填，默认「包」
    pricing_mode?: 'case' | 'piece' | 'unit';  // 默认 case
    unit_piece_qty?: number;    // 每箱件数，默认 1
    price_piece?: number | null;// 件价
    price_unit?: number | null; // 单件零售价
    pinyin?: string;            // 拼音，选填
    is_adjustable?: boolean     // 是否允许改价，默认 false
  }
}
```

| 校验规则 | |
|----------|---|
| 名称必填 | name 为空返回 4001 |
| 93 前缀 | material_code 以 93 开头=调货品，前端展示 is_adjustable=true 允许改价（导入数据约定，非服务端强制） |

#### 返回 data
```json
{ "_id": "新增商品ID" }
```

### 3.4 修改商品

- **云函数**：`products`
- **Action**：`update`
- **最小权限**：orderer/sorter/warehouse/admin（**商品管理全角色 CRUD，1.0**）

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

- **云函数**：`customers` / `customers`
- **最小权限**：orderer/admin

#### 请求
```json
{ type: 'customers', searchKey?: string }   // event 平铺；全量返回，前端本地过滤
```

#### 返回 data (list)
```typescript
{
  // 全量返回（T51-1 起分页拉全量），camelCase：
  Array<{
    _id: string;
    name: string;      // 客户名
    alias: string;     // 别名（智能录入匹配用）
    region: string;    // 区域名称（直接存名称字符串，无 region_id 外键）
    phone: string | null;
    contact: string | null;
  }>
}
```

### 4.2 客户详情

- **云函数**：`customers` / `customer-detail`
- **最小权限**：orderer/admin

#### 请求：`{ type: 'customer-detail', filter: { _id: '' } }`

#### 返回 data：同 4.1 列表单条字段，无 list 包裹。

### 4.3 新增客户

- **云函数**：`customers`
- **Action**：`create`
- **最小权限**：orderer/sorter/warehouse/admin（**客户管理全角色 CRUD，1.0**）

#### 请求
```typescript
{
  action: 'create',
  // event 平铺：
  name: string;             // 必填（为空返回 4001）
  alias?: string;
  region?: string;          // 区域名称
  phone?: string | null;
  contact?: string | null;
}
```

#### 返回：`{ _id }`

### 4.4 修改客户

- **云函数**：`customers` / `update`
- **最小权限**：orderer/sorter/warehouse/admin（**客户管理全角色 CRUD，1.0**）

#### 请求：`{ action:'update', payload:{ id, ...updateFields } }`

#### 返回：`{ id, updated:true }`

---

## 5. 区域相关

### 5.1 区域列表

- **云函数**：`regions` / `regions`
- **最小权限**：all

#### 请求：customers 云函数 `{ type: 'regions' }`（customers 内部 action，非独立 regions 云函数）

#### 返回 data
```typescript
Array<{ name: string; sort: number; status: 1 }>
// 示例：汉滨区/汉阴县/石泉县/宁陕县/紫阳县/岚皋县/平利县/镇坪县/旬阳市/白河县/外县
```

> ⚠️ 现状说明：客户区域实际直接存**名称字符串**（customers.region），不依赖 regions 集合外键；前端当前未消费此接口（区域下拉用静态名单）。regions 集合存在 data.data 嵌套历史脏数据（见 T52 卡 P3 登记），无业务链路读取。

### 5.2 新增区域

- **云函数**：`regions` / `create`
- **最小权限**：admin

#### 请求
```json
{ "action": "create", "payload": { "name": "新区域", "sort": 99 } }
```

### 5.3 修改区域

- **云函数**：`regions` / `update`
- **最小权限**：admin

#### 请求：`{ action:'update', payload:{ id, name, sort, status } }`

---

## 6. 订单相关

### 6.1 订单列表

- **云函数**：`orders` / `orders`
- **最小权限**：orderer/sorter/warehouse/admin（**全部，完整视图，无价格脱敏与精简视图，1.0**）

#### 请求
```typescript
{
  // event 平铺：
  action: 'list',
  timeTab?: 'today' | 'week' | 'month';   // 时间范围（北京时间，默认全部）
  searchKey?: string                  // 订单号/客户名模糊搜索
}
```

#### 返回 data (list)
```typescript
{
  // 全量返回（T51-1 起分页拉全量，前端本地过滤/分页），camelCase：
  Array<{
    _id: string;
    orderNo: string;                 // 乾多多-YYYYMMDD-NNNN
    status: 'submitted' | 'sorted' | 'confirmed' | 'completed' | 'cancelled';
    customerId: string;
    customerName: string;
    customerRegion: string;          // 区域名称（下单时快照）
    items: Array;                    // 商品快照（含 0件0包 行，前端展示时过滤）
    totalAmount: number;             // 全员可见（无脱敏，1.0）
    payment_status: 'unpaid' | 'pending' | 'paid';   // 收款状态（默认 unpaid）
    paymentStatus: 'unpaid' | 'pending' | 'paid';    // 双写字段（兼容）
    received_amount: number;         // 累计已确认实收（分位精度）
    receivedAmount: number;          // 双写字段（兼容）
    total_discount: number;          // 已确认折价/货损合计
    sortStatus: 'pending' | 'done';  // 分拣状态（与 status 双轨派生）
    outStatus: 'pending' | 'done';   // 出库状态
    sortTime: Date | null; outTime: Date | null;
    ship_large: number | null;       // 实际发货大件数（出库确认时写入）
    ship_medium: number | null;
    ship_small: number | null;
    shared_to_wechat: boolean;       // 已转发微信
    created_at: Date;
    createdByName: string; createdByRole: string;
    logs: Array;                     // 操作记录
  }>
}
```

### 6.2 订单详情

- **云函数**：`orders` / `order-detail`
- **最小权限**：orderer/sorter/warehouse/admin（**全部，完整视图，无价格脱敏与精简视图，1.0**）
- **用途**：返回数据（含 items/amount/payment_status/orderNo/customer/region/phone）用于订单详情、送货单打印与赊销对账（1.0 已取消转发收款卡片）；含 `ship_large`/`ship_medium`/`ship_small` 物流包裹字段（详情显示物流包裹；导出报表/出库单/单订单导出取用）
- **操作记录**：订单详情页新增「操作记录」区块，订单操作记录（创建/状态流转/收款/备注修改等）通过 `order_logs` 集合存储，随订单详情一并返回。

#### 请求：`{ type:'order-detail', filter:{ _id:'' } }`

#### 返回 data（对象）
```typescript
{
  // 同 6.1 列表所有字段 +（含 payment_status/received_amount 收款状态、ship_large/ship_medium/ship_small 物流包裹；送货单数据同此返回）：
  items: Array<{            // 字段名=items（快照），非 items_snapshot
    _id: string;             // 商品 ID
    material_code: string;   // 商品料号
    name: string; spec: string; unit: string;
    pricing_mode: 'case' | 'piece' | 'unit';
    piece_qty: number; package_qty: number;
    price_piece: number;     // 成交件价（快照）
    price_unit: number;      // 成交单件价（快照）
    qty: number; price: number;  // 归一化展示字段（服务端补齐）
    amount: number;          // 行金额（服务端重算）
    is_adjustable: boolean; remark: string | null;
  }>;
  logs: Array<{ action: string; desc: string; operatorName: string; role: string; time: number }>;  // 操作记录（随详情返回）
}
```

### 6.3 创建订单（含快照）

- **云函数**：`orders` / `create`
- **最小权限**：orderer/sorter/warehouse/admin（**全员可下单，1.0**）

#### 请求
```typescript
{
  action: 'create',
  // event 平铺（无 payload 包裹），camelCase：
  customerId: string;             // 必填
  customerName?: string; customerRegion?: string;
  totalAmount: number;            // 前端预算值仅作 0 元快速拦截；落库总额=服务端按明细重算（T51-1）
  items: Array<{
    _id: string;                  // 商品 ID
    name: string; material_code: string; spec: string; unit: string;
    pricing_mode: 'case' | 'piece' | 'unit';
    piece_qty: number;            // ≥ 0
    package_qty: number;          // ≥ 0
    price_piece: number;          // 成交件价（前端来源：客户上次成交价 > 商品默认价；is_adjustable 商品可人工改价）
    price_unit: number;           // 成交单件价（同上）
    remark?: string | null;
  }>;
}
```

| 校验规则 | |
|----------|---|
| items 非空 | 有效商品为空返回 2001 |
| **价格来源（1.0）** | 前端组装：同客户最近订单成交价（orders/lastOrder 拉取）> 商品默认价；is_adjustable 商品允许人工改价。行金额 amount 由服务端按 qty×price 分位重算，不信任前端 amount；订单总额=明细求和（T51-1 起不再信任前端 totalAmount） |
| piece_qty + package_qty | 至少一个 > 0，否则整条明细被忽略 |
| 计价金额 | 服务端重算，不信任前端 |
| **0 金额拦截（双重校验）** | ① `totalAmount <= 0` → 2001「订单金额不能为 0」；② 过滤 0件0包 行后，有效商品为空 → 2001「订单商品数量必须大于 0」，物品金额合计 ≤ 0 → 2001「订单金额必须大于 0，请检查商品数量/单价」。`update`（编辑订单）同规则 |
| **0 值导出留空** | `exportOutbound` / `exportLedger` / `exportDailySummary` 中数量为 0 的件数/物流大中小件单元格输出空字符串（不写 0），与界面口径一致 |

| 行为说明 | |
|----------|---|
| 订单号 | 服务端生成 `乾多多-YYYYMMDD-NNNN`（当日顺序号）；创建人姓名/角色服务端记录（createdByName/createdByRole） |

#### 返回 data
```json
{ "_id": "orders._id", "orderNo": "乾多多-20260730-0001" }
```

### 6.4 出库确认 + 分拣动作（update-status）

> 状态流转动作统一收敛到 `update-status`：分拣员**分拣完成**（submitted→sorted，受 `sort:task` 权限控制）；库管**出库确认**（sorted→confirmed，受 `warehouse:confirm` 权限控制，写 ship_* 实际发货件数）；`rejected`（驳回）为二期规划遗留状态，当前流程不触发。

- **云函数**：`orders` / `update-status`（`confirm` 向后兼容）
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

- **云函数**：`orders` / `pick-stash`
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

- **云函数**：`orders` / `mark-printed`
- **最小权限**：orderer/sorter/warehouse/admin（全员可蓝牙打印，1.0）

#### 请求：`{ action:'mark-printed', payload:{ id } }`

#### 返回：`{ id, printed:true, printed_at }`

### 6.7 收款登记（第 1 步：登记，1.0）

- **云函数**：`receivable` / `collect`
- **最小权限**：orderer/sorter/admin（receivable:collect；1.0 放开分拣员，库管不可）
- **说明**：下单员/分拣员登记收款（**以商家到账为准**），生成一条 `status=pending`（待确认）收款记录，订单 `payment_status=unpaid→pending`。一笔订单可多次登记（部分收款累计）；登记可选填**折价/货损金额（collect_discount）**记录实收与应付差额（如100元货品实收90元，折价10元）。

#### 请求
```typescript
{
  action: 'collect',
  orderId: string;          // 订单 ID（必填）
  amount: number;           // 实收金额（必填，> 0，以商家到账为准）
  paymentMethod?: string;   // 收款渠道 cash/wechat（默认 cash）
  note?: string;            // 备注
  discount?: number;        // 折价/货损金额，≥ 0（需 receivable:discount 权限，否则 403）
  clientToken?: string      // 幂等键：前端每次打开弹窗生成一个；双击/重试带同一 token 复用首次 pending 记录
}
```

| 入参 | 类型 | 必填 | 说明 |
|---|---|---|---|
| orderId | string | ✅ | 订单 ID |
| amount | number | ✅ | 实收金额，> 0；超过剩余欠款（订单金额−已收−已确认折价−pending 占额）返回 4002 |
| paymentMethod | string | ❌ | 收款渠道（默认 `cash`） |
| note | string | ❌ | 备注 |
| discount | number | ❌ | 折价/货损金额，≥ 0（需 `receivable:discount` 权限） |
| clientToken | string | ❌ | 幂等键（双击/网络重试防重复登记） |

#### 返回 data
```typescript
{ paymentId: string }                 // 新登记时
{ paymentId: string, reused: true }   // 幂等命中（同一 clientToken 重复提交）
```

> 登记人（registered_by）由服务端记录当前操作者，前端不可传。登记后需库管调 6.8 确认收款，收款流程才算完成。

### 6.8 确认收款（第 2 步：库管确认，1.0）

- **云函数**：`receivable` / `confirmPayment`
- **最小权限**：warehouse/admin（receivable:confirm，确认收款，收款流程最后一步）
- **说明**：库管对已登记（pending）的收款记录点【确认收款】→ 记录 `status=pending→confirmed`（T50-2 条件更新防并发双记）；确认后服务端重算订单：`received_amount=Σ已确认实收`，结清则 `payment_status=paid`，否则保持 `pending`。传 paymentId 确认单笔；传 orderId 确认该订单最早一条 pending（逐笔确认，前端 pendingConfirm 列表驱动）。

#### 请求
```typescript
{
  action: 'confirmPayment',
  paymentId?: string;      // 收款记录 ID（推荐；二选一）
  orderId?: string         // 或订单 ID（确认该订单最早一条 pending；二选一）
}
```

| 入参 | 类型 | 必填 | 说明 |
|---|---|---|---|
| paymentId | string | 二选一 | 单条收款记录 ID（pendingConfirm 列表项） |
| orderId | string | 二选一 | 订单 ID（确认最早一条 pending 记录） |

#### 返回 data
```typescript
{ }                // 确认成功（空对象；订单金额/状态由服务端重算落库）
{ reused: true }   // 幂等命中：该笔已被确认（含并发抢先场景）
```

> 确认人/确认时间由服务端记录（confirmed_by/confirmed_at）。订单剩余欠款 = 订单金额 − 已确认实收 − 已确认折价，守恒由 dashboard/导出统一口径保证。

### 6.9 修改订单备注

- **云函数**：`orders` / `update-remark`
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

- **云函数**：`receivable` / `receivable`
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

### 7.4 角色权限配置（权限矩阵）

> **云函数**：`users`。权限矩阵 = 权限键 × 角色的二维开关，管理员可在「成员管理 → 权限配置」逐项开关，改动即时保存至 `perm_configs` 集合。登录/门禁按覆盖后的实际权限生效。

#### 7.4.1 读取各角色实际权限（users.perm-config）

- **最小权限**：admin（页面仅管理员显示；后端校验当前登录者为 admin）

#### 请求
```typescript
{ action: 'perm-config' }
```

#### 返回 data（每个角色的有效权限数组）
```typescript
{
  admin:   string[];  // 含 member:manage（固定）
  orderer: string[];
  sorter:  string[];
  warehouse: string[];
}
```
> 返回的是「默认 ∪ 覆盖」后的**实际生效**数组；无覆盖记录的回落默认（全员开放）。

#### 7.4.2 保存某角色权限（users.save-perm）

- **最小权限**：admin

#### 请求
```typescript
{
  action: 'save-perm',
  role: 'admin' | 'orderer' | 'sorter' | 'warehouse';
  permissions: string[];  // 该角色的完整权限键数组（前端按矩阵勾选结果提交）
}
```

#### 行为
- 校验 `role` 合法；过滤非法键；
- 锁定权限保护：`member:manage` 仅 admin 且不可关闭（防锁死）——非 admin 一律过滤，admin 强制保留；
- 覆盖写入 `perm_configs`（存在则更新，否则新增）。

#### 返回 data：`{ role, permissions: string[] }`（保存后的实际权限数组）

#### 7.4.3 恢复默认（users.reset-perm）

- **最小权限**：admin

#### 请求
```typescript
{ action: 'reset-perm', role: 'admin' | 'orderer' | 'sorter' | 'warehouse' }
```

#### 行为
删除该角色的 `perm_configs` 覆盖记录，回落默认（全员开放，成员管理仍仅管理员）。

#### 返回 data：`{ role, permissions: string[] }`（默认权限数组）

#### 7.4.4 权限键全集（17 个，按分组）

| 分组 | 权限键 |
|------|--------|
| 订单管理 | `order:create` `order:edit` `order:delete` `order:print` `order:export` |
| 商品管理 | `product:view` `product:edit` |
| 客户管理 | `customer:view` `customer:edit` |
| 分拣作业 | `sort:task` |
| 库管出库 | `warehouse:confirm` |
| 赊销收款 | `receivable:view` `receivable:collect` `receivable:confirm` `receivable:discount` |
| 报表中心 | `report:view` `report:export` `report:ledger` |
| 系统管理 | `member:manage`（锁定，仅 admin） |

#### 7.4.5 默认矩阵（全员开放）

| 权限键 | orderer | sorter | warehouse | admin |
|--------|:---:|:---:|:---:|:---:|
| 订单/商品/客户/分拣/出库/报表/大部分赊销 | ✅ | ✅ | ✅ | ✅ |
| `receivable:collect` 登记收款 | ✅ | ✅ | ❌ | ✅ |
| `receivable:confirm` 确认收款 | ❌ | ❌ | ✅ | ✅ |
| `member:manage` 成员管理 | ❌ | ❌ | ❌ | ✅ 锁定 |

### 7.1 用户列表

- **云函数**：`users` / `users`
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

- **云函数**：`users` / `create`
- **最小权限**：admin
- **首管理员（方案 A 零配置）**：首管理员**无需通过 `users` 预置**——系统首次启动无 admin 时，`auth` 自动把第一位登录者赋为 `role=admin`（见 §2.1）。`users` 仅用于管理员新增普通成员（orderer/sorter/warehouse/admin）。环境变量 `ADMIN_OPENID` 预置首管理员 openid 仅作**可选兜底（方式二）**。

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

- **云函数**：`users` / `update`
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
        "qty": { "piece_qty": 2, "package_qty": 0 }
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

> **对接说明**：`transcribe` 对接**腾讯云语音识别（录音文件识别）**，运行时从 `system_config` 集合读取腾讯云语音配置（`ai.tencent`，见 §7B `getAiConfig`）。若未配置腾讯云语音，则**降级返回空文本**（`data.text = ""`），前端可提示「语音识别未配置」。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| action | string | ✅ | 固定 "transcribe" |
| fileID | string | ❌ | 云存储中的音频文件 ID（与 audioUrl 二选一） |
| audioUrl | string | ❌ | 公网可访问的音频地址（与 fileID 二选一，一般用 fileID） |
| audioText | string | ❌ | 兜底纯文本：未配置/无音频时直接原样返回 |

**返回**：
```json
{
  "code": 0,
  "data": {
    "text": "送2件手抓饼给东一路刀削面",
    "engine": "tencent-asr"
  }
}

> `engine` 取值：`tencent-asr`（识别成功）/ `disabled`（未配置或未启用）/ `no-audio`（未收到音频）/ `fallback`（识别失败，`text` 为 audioText 兜底值，并附 `error` 字段）。
```

---

## 7B. 系统配置（system）

> 系统设置功能（AI 服务配置 + 打印机配置 + 数据备份）统一收敛到 `system` 云函数。AI 服务配置含**腾讯云语音（tencent，ASR）**与**TokenHub 大模型（tokenhub，NLP，OpenAI 兼容）**两部分，配置存储于 `system_config` 集合。

#### 7B.1 获取 AI 服务配置（system.getAiConfig）

**调用方式**：`wx.cloud.callFunction({ name: 'system', data: { action: 'getAiConfig' } })`

- **最小权限**：admin
- **说明**：返回当前 AI 服务配置（腾讯云语音 + TokenHub NLP）与打印机配置。

**返回 data**：
```json
{
  "ai": {
    "tencent": { "enabled": false, "secretId": "", "secretKey": "", "engine": "16k_zh" },
    "tokenhub": { "enabled": false, "apiKey": "", "baseUrl": "https://tokenhub.tencentmaas.com/v1", "model": "hy3" }
  },
  "printer": { }
}
```

#### 7B.2 更新 AI 服务配置（system.updateAiConfig）

**调用方式**：`wx.cloud.callFunction({ name: 'system', data: { action: 'updateAiConfig', aiConfig: { ... } } })`

- **最小权限**：admin（仅管理员）
- **入参 `aiConfig`**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| tencent | object | ❌ | 腾讯云语音（ASR）配置 |
| tencent.enabled | boolean | ❌ | 是否启用腾讯云语音 |
| tencent.secretId | string | ❌ | 腾讯云 SecretId（主账号/已授权子账号） |
| tencent.secretKey | string | ❌ | 腾讯云 SecretKey |
| tencent.engine | string | ❌ | 识别引擎：`16k_zh`（通用16K，默认）/ `8k_zh`（电话8K） |
| tokenhub | object | ❌ | TokenHub 大模型（NLP）配置，OpenAI 兼容 |
| tokenhub.enabled | boolean | ❌ | 是否启用 TokenHub NLP |
| tokenhub.apiKey | string | ❌ | TokenHub API Key（sk-开头，23 个模型通用） |
| tokenhub.baseUrl | string | ❌ | 接口地址，固定 `https://tokenhub.tencentmaas.com/v1` |
| tokenhub.model | string | ❌ | 模型名，默认 `hy3`（23 个免费额度模型可切换） |

**返回 data**：`{ updated: true }`

> 打印机配置与数据备份相关接口亦由 `system` 云函数承载（详见《系统设置》原型），本文档聚焦 AI 服务配置接口。

---

## 8. 接口状态矩阵

| 接口 | orderer | sorter | warehouse | admin |
|------|---------|--------|-----------|-------|
| 2.1 登录 | ✅ 小程序 | ✅ 小程序 | ✅ 小程序 | ✅ 小程序 |
| 3.1 商品列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 3.2 商品详情 | ✅ | ✅ | ✅ | ✅ |
| 3.3 新增商品 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 3.4 修改商品 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 4.1 客户列表 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| 4.3 新增客户 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
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
> 首管理员由 `auth` 方案 A 零配置自动赋值（见 §2.1），无需通过 `users` 预置。

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
| 订单号格式 | `乾多多-YYYYMMDD-NNNN` |
| 示例 | `乾多多-20260730-0001` |
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
| **1.0** | **2026-08-03** | **新增 3 个接口：6.5 配货暂存（pick-stash）、6.7 收款登记（collect）、6.8 修改备注（update-remark），共 23 个 action；订单号前缀改为"乾多多-"；订单状态 submitted→待发货、checked→已发货；"确认订单"升级为 6.4"配完"（submitted/checked 两态均可直接调用，无需等分拣确认，新增 ship_large/ship_medium/ship_small）；商品列表新增 usage 字段并支持按使用频率降序；订单列表/详情对库管价格脱敏、新增 collect 收款状态字段（列表/详情/送货单）；分拣员动作："确认已发货/驳回"，取消校对环节 |
| **1.0** | **2026-08-04** | **赊销收款管理版（对齐产品 1.0）：①新增 2 接口：6.10 赊销看板（receivable，客户维度每日欠款+累计总欠款）、6.8 确认收款（collect-confirm），共 25 个 action；②收款改两步：6.7 下单员/分拣员登记(→pending) → 6.8 库管确认(→paid)，登记可填折价/货损（collect_discount）；③下单/改单/删单全员权限：6.3 创建订单放开至 4 角色，订单列表/详情取消价格脱敏与精简视图（全员完整视图）；④6.3 所有商品可订单内自定义价格（tmp_ 价，仅当前订单有效），未传价时默认取客户上次成交价；⑤6.9 修改备注全员可用；⑥6.6 标记已打印全员可用；⑦订单列表/详情字段 collect → payment_status/received_amount；⑧sorter 角色补入登录/用户接口 role 枚举与状态矩阵；⑨取消商户收款码与259号文合规内容（转发收款卡片下线） |

---

> **文档结束**  
> 如发现接口契约不匹配，请优先修改调用方代码，并在版本历史补充记录。
