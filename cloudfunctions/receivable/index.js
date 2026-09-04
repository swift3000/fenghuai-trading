const cloud = require('wx-server-sdk')
const XLSX = require('xlsx')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== 北京时间边界工具（CLI 部署不注入运行时 TZ，统一在此按北京时间显式计算）=====
const BJ_OFFSET_MS = 8 * 3600 * 1000
function bjNow(){ const d=new Date(Date.now() + BJ_OFFSET_MS); return { getFullYear:()=>d.getUTCFullYear(), getMonth:()=>d.getUTCMonth(), getDate:()=>d.getUTCDate(), getDay:()=>d.getUTCDay(), getHours:()=>d.getUTCHours(), getMinutes:()=>d.getUTCMinutes(), getSeconds:()=>d.getUTCSeconds(), getTime:()=>d.getTime() } }
function bjDate(y, mo, d, h, mi, s, ms){ return new Date(Date.UTC(y, mo, d, h||0, mi||0, s||0, ms||0) - BJ_OFFSET_MS) }
function bjTodayStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate()) }
function bjTodayEnd(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999) }
function bjTomorrowStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), n.getDate()+1) }
function bjWeekStart(){ const n=bjNow(); const day=n.getDay()||7; return bjDate(n.getFullYear(), n.getMonth(), n.getDate()-day+1) }
function bjWeekEnd(){ const n=bjNow(); const day=n.getDay()||7; return bjDate(n.getFullYear(), n.getMonth(), n.getDate()-day+6, 23, 59, 59, 999) }
function bjMonthStart(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth(), 1) }
function bjMonthEnd(){ const n=bjNow(); return bjDate(n.getFullYear(), n.getMonth()+1, 0, 23, 59, 59, 999) }
function bjFromStr(s, endDay){ const p=String(s).split("-").map(Number); return bjDate(p[0], p[1]-1, p[2], endDay?23:0, endDay?59:0, endDay?59:0, endDay?999:0) }
function bjDayAgo(i){ const n=bjNow(); const dt=new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()-i)); const y=dt.getUTCFullYear(), m=dt.getUTCMonth(), d=dt.getUTCDate(); return { start:bjDate(y,m,d), end:bjDate(y,m,d,23,59,59,999), label:(m+1)+"/"+d } }
// ===== 北京时间边界工具结束 =====


// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null


// 转义搜索词中的正则特殊字符
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 金额统一按「分」取整，规避浮点误差（0.1+0.2 之类）导致的状态/校验偏差
function toCents(n) {
  return Math.round((Number(n) || 0) * 100)
}
// T50-1：全量分页拉取——服务端单次查询默认 limit=100（硬上限 1000），
// 财务聚合（应收/已收/未结清）必须拉全量，否则订单数 >100 后汇总静默少算、财务报表失真
// 批次固定 100：与 SDK 默认单批一致，保证单批不触发 1MB 响应上限（-602001，
// orders 文档含 items 快照，大批量易超限）；循环 skip 拉全量
async function fetchAll(query) {
  const size = 100
  const all = []
  for (let skip = 0; ; skip += size) {
    const batch = await query.skip(skip).limit(size).get()
    const data = (batch && batch.data) || []
    all.push(...data)
    if (data.length < size) break
  }
  return all
}
// 剩余欠款（分）= 订单金额 − 累计实收 − 累计折价
function remainingCents(total, received, discount) {
  return Math.max(0, toCents(total) - toCents(received) - toCents(discount))
}

// 关联各订单的已确认收款（payments 独立集合）：注入 o.confirmedPays = { amount, discountCents }
// 口径对齐原型：已收 = 实收 + 已确认折价；未结清 = 应收 - 已收（守恒）
// T53-B1（用户拍板方案A）：同时注入 o.pendingPays = 已登记未确认（pending）收款——台账"已收"含待确认部分并标注
async function attachConfirmedPayments(orders) {
  const ids = orders.map(o => o._id).filter(Boolean)
  if (ids.length === 0) return
  const confirmedByOrder = {}
  const pendingByOrder = {}
  try {
    // T50-1：全量拉取（默认 100 截断会在订单数多时漏计已确认收款）
    const pays = await fetchAll(db.collection('payments').where({
      orderId: db.command.in(ids),
      status: db.command.in(['confirmed', 'pending'])
    }))
    pays.forEach(p => {
      const oid = p.orderId || p.order_id
      if (!oid) return
      const bucket = p.status === 'pending' ? pendingByOrder : confirmedByOrder
      if (!bucket[oid]) bucket[oid] = { amount: 0, discountCents: 0 }
      bucket[oid].amount += (p.amount || 0)
      bucket[oid].discountCents += toCents(p.discount || 0)
    })
  } catch (e) { console.error('关联订单已确认收款失败', e) }
  orders.forEach(o => {
    o.confirmedPays = confirmedByOrder[o._id] || { amount: 0, discountCents: 0 }
    o.pendingPays = pendingByOrder[o._id] || { amount: 0, discountCents: 0 }
  })
}
// 账龄（天）：订单创建时间到现在的整天数（对齐原型 debtAgeDays）
function debtAgeDays(order) {
  const t = new Date(order.created_at).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}


// 权限校验
async function checkPermission(permission) {
  const { OPENID: __rawOID } = cloud.getWXContext()
  const OPENID = __impersonatedOpenid || __rawOID
  if (!OPENID) { return { code: 401, message: '无法获取用户身份，请在小程序内访问' } }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
  if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }

  if (user.role === 'admin') return { code: 0 }
  if (user.permissions && user.permissions.includes(permission)) return { code: 0 }
  return { code: 403, message: '无权限访问' }
}

// 追加订单操作记录
async function getUserIdentity() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { name: '系统', role: 'system' }
  try {
    const r = await db.collection('users').where({ openid: OPENID }).get()
    if (r.data && r.data.length > 0) {
      const u = r.data[0]
      return { name: u.name || '未知', role: u.role || 'orderer' }
    }
  } catch (e) { console.error('获取用户身份失败', e) }
  return { name: '未知', role: 'orderer' }
}

async function appendOrderLog(orderId, action, desc) {
  if (!orderId) return
  try {
    const identity = await getUserIdentity()
    await db.collection('orders').doc(orderId).update({
      data: {
        logs: db.command.push([{ action, desc, operatorName: identity.name, role: identity.role, time: Date.now() }])
      }
    })
  } catch (e) {
    console.error('记录订单操作日志失败', e)
  }
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const { action } = event
  // T57-RC-4：顶层错误边界（同 orders）——非法 paymentId/orderId 等路径不再裸异常 500
  try {
  switch (action) {
    case 'dashboard': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      const { viewTab, timeTab, searchKey } = event
      const now = new Date()
      
      // 时间范围过滤
      let dateFilter = null
      if (timeTab === 'today') {
        const start = bjTodayStart()
        const end = bjTodayEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'week') {
        // 周一为一周起点（getDay() 周日=0，需转为 7，否则周日查"本周"返回空集）
        const start = bjWeekStart()
        const end = bjWeekEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'month') {
        const start = bjMonthStart()
        const end = bjMonthEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'custom' && event.startDate && event.endDate) {
        // 自定义日期范围
        const start = bjFromStr(event.startDate)
        const end = bjFromStr(event.endDate, true)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'day') {
        // T62-V5：'day' 与 report summary 口径对齐（=今日）。原实现 'day' 落入无过滤分支
        // 静默等同 'all'（reports 前端发 'day'，直调/新前端误传会把历史单算进今日视图）
        const start = bjTodayStart()
        const end = bjTodayEnd()
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      }

      // 合并视图/时间/搜索为单次 where：Query.where() 会整体替换旧条件而非合并
      const conds = []
      if (viewTab === 'unpaid') {
        // 未结清：有欠款（待确认或部分结清）
        conds.push({ paymentStatus: db.command.in(['unpaid', 'pending']) })
      } else if (viewTab === 'settled') {
        // 已结清：已全额付款
        conds.push({ paymentStatus: 'paid' })
      }
      // ledger（客户台账）：显示所有客户，不过滤订单状态
      
      // 应用时间过滤
      if (dateFilter) {
        conds.push({ ...dateFilter })
      }
      // T57-RB-3：已取消订单不计入赊销台账/未结清/已结清聚合（原实现 cancelled 单仍参与
      // 欠款统计，客户"结清"状态与订单状态矛盾）
      conds.push({ status: db.command.neq('cancelled') })
      
      // 应用搜索过滤
      if (searchKey) {
        conds.push({ customerName: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) })
      }
      
      let query = db.collection('orders')
      if (conds.length === 1) query = query.where(conds[0])
      else if (conds.length > 1) query = query.where(db.command.and(conds))

      // T50-1：全量拉取（默认 100 截断会少算财务汇总）
      const orders = await fetchAll(query)
      await attachConfirmedPayments(orders)
      
      // 按客户维度聚合统计（已收口径 = 实收 + 已确认折价，守恒：应收=已收+未结清）
      const customerMap = {}
      // T53-B1（方案A）：已收含待确认部分（pending 实收+折价），前端标注"含待确认"
      let totalPendingCents = 0
      orders.forEach(order => {
        const customerId = order.customerId
        if (!customerId) return  // 脏数据防护：无 customerId 的孤儿订单不参与客户聚合
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            _id: customerId,
            name: order.customerName,
            region: order.customerRegion || '',
            contact: order.customerContact || '',
            phone: order.customerPhone || '',
            totalAmount: 0,
            receivedAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            orderCount: 0,
            paidOrders: 0,
            maxAge: 0,
            orders: []
          }
        }
        
        const customer = customerMap[customerId]
        const total = order.totalAmount || 0
        const received = order.received_amount || order.receivedAmount || 0
        // 已确认折价（分）：只认 payments.status=confirmed，口径对齐原型 orderPaidAmount
        const confDiscCents = (order.confirmedPays && order.confirmedPays.discountCents) || 0
        // T53-B1（方案A）：已收（分）= 实收 + 已确认折价 + 待确认实收 + 待确认折价；未结清 = 应收 - 已收（守恒，不为负）
        const pend = order.pendingPays || { amount: 0, discountCents: 0 }
        const pendCents = toCents(pend.amount) + pend.discountCents
        totalPendingCents += pendCents
        const receivedCents = toCents(received) + confDiscCents + pendCents
        // 以「分」为单位整数累加，避免浮点误差（0.1+0.2 类问题）
        customer.totalCents = (customer.totalCents || 0) + toCents(total)
        customer.receivedCents = (customer.receivedCents || 0) + receivedCents
        customer.pendingCents = (customer.pendingCents || 0) + pendCents
        customer.unpaidCents = (customer.unpaidCents || 0) + Math.max(0, toCents(total) - receivedCents)
        customer.orderCount += 1
        // T59-R7B-2（方案A，2026-08-31 老板拍板）：客户级"已结清"判定改按 payment_status——
        // 全部订单 payment_status=paid 才算结清；派生欠款(含待确认)归零但账务仍 pending 的，不得判结清。
        if (order.paymentStatus === 'paid') customer.paidOrders += 1
        // 最长欠款账龄：仅统计未结清订单（剩余欠款>0），对齐原型 maxAge
        const unpaidNow = Math.max(0, toCents(total) - receivedCents)
        if (unpaidNow > 0) customer.maxAge = Math.max(customer.maxAge, debtAgeDays(order))
        customer.orders.push({
          _id: order._id,
          orderNo: order.orderNo,
          totalAmount: total,
          receivedAmount: received,
          paidAmount: Math.round(receivedCents) / 100,
          unpaidAmount: Math.max(0, Math.round(toCents(total) - receivedCents) / 100),
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.created_at,
          debtAgeDays: debtAgeDays(order)
        })
      })
      
      // 聚合值由「分」还原为元（四舍五入到分的数字，保持 number 供前端 toFixed/排序/求和）
      let customers = Object.values(customerMap).map(c => ({
        ...c,
        totalAmount: Math.round(c.totalCents) / 100,
        receivedAmount: Math.round(c.receivedCents) / 100,
        paidAmount: Math.round(c.receivedCents) / 100,
        unpaidAmount: Math.round(c.unpaidCents) / 100,
        // T53-B1（方案A）：待确认金额（pending 实收+折价），>0 时前端标注"含待确认"
        pendingAmount: Math.round(c.pendingCents || 0) / 100
      }))
      
      // 根据视图标签过滤客户
      if (viewTab === 'unpaid') {
        // T59-R7B-2（方案A）：未结清 = 存在非 paid 订单（派生欠款口径会把 pending 归零，不可用于判结清）
        customers = customers.filter(c => (c.paidOrders || 0) < (c.orderCount || 0))
      } else if (viewTab === 'settled') {
        // T59-R7B-2（方案A）：已结清 = 全部订单 payment_status=paid
        customers = customers.filter(c => (c.orderCount || 0) > 0 && (c.paidOrders || 0) === (c.orderCount || 0))
      }
      
      // 按欠款金额降序排序
      customers.sort((a, b) => b.unpaidAmount - a.unpaidAmount)
      
      // 计算总计
      const totalReceivable = customers.reduce((sum, c) => sum + c.totalAmount, 0)
      const totalReceived = customers.reduce((sum, c) => sum + c.paidAmount, 0)
      const totalUnpaid = customers.reduce((sum, c) => sum + c.unpaidAmount, 0)
      
      return {
        code: 0,
        data: {
          totalReceivable,
          totalReceived,
          totalUnpaid,
          // T53-B1（方案A）：全局待确认金额，>0 时 hero"已收"标注含待确认
          totalPendingAmount: Math.round(totalPendingCents) / 100,
          customerCount: customers.length,
          // T59-R7B-2（方案A）：已结清家数按 payment_status（全部订单 paid）
          settledCount: customers.filter(c => (c.orderCount || 0) > 0 && (c.paidOrders || 0) === (c.orderCount || 0)).length,
          customers
        }
      }
    }
    
    case 'customerDetail': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      // 获取单个客户的详细信息
      const { customerId } = event
      if (!customerId) {
        return { code: 4001, message: 'customerId 参数缺失' }
      }
      
      // T50-1：全量拉取（默认 100 截断会少算财务汇总）
      const orders = await fetchAll(
        db.collection('orders').where({ customerId, status: db.command.neq('cancelled') }).orderBy('created_at', 'desc')
      )
      await attachConfirmedPayments(orders)
      // T53-B1（方案A）：口径对齐 dashboard——已收 = 实收 + 已确认折价 + 待确认实收 + 待确认折价
      const totalAmount = orders.reduce((sum, o) => sum + toCents(o.totalAmount || 0), 0)
      const paidCents = orders.reduce((sum, o) => {
        const pend = o.pendingPays || { amount: 0, discountCents: 0 }
        return sum + toCents(o.received_amount || o.receivedAmount || 0) + ((o.confirmedPays && o.confirmedPays.discountCents) || 0) + toCents(pend.amount) + pend.discountCents
      }, 0)
      const pendingCentsSum = orders.reduce((sum, o) => {
        const pend = o.pendingPays || { amount: 0, discountCents: 0 }
        return sum + toCents(pend.amount) + pend.discountCents
      }, 0)
      const paidAmount = Math.round(paidCents) / 100
      const total = Math.round(totalAmount) / 100
      
      return {
        code: 0,
        data: {
          orders,
          totalAmount: total,
          paidAmount,
          unpaidAmount: Math.max(0, Math.round(totalAmount - paidCents) / 100),
          // T53-B1（方案A）：待确认金额，>0 时前端标注
          pendingAmount: Math.round(pendingCentsSum) / 100
        }
      }
    }
    
    case 'collect': {
      const __p = await checkPermission('receivable:collect'); if (__p.code !== 0) return __p
      // 登记收款（两步流程第一步；下单员/分拣员/管理员可，库管不可）
      const { orderId, paymentMethod, note, clientToken } = event
      // T63-9：amount 独立 let——与 discount 同款归一化需重赋值（解构 const 会撞
      // "Assignment to constant variable"，对齐 discount 注释里的 RB-4 教训）
      let amount = event.amount
      // discount 单独用 let：RC-1 归一化时需对折价重赋值（解构 const 不可重赋值，
      // 曾致 "Assignment to constant variable" 崩溃——RB-4 回归测试抓出）
      let discount = event.discount

      // 折价/减免属独立权限：即使持有 receivable:collect，若未配置 receivable:discount 也不得折价（纵深防御，前端已用 canDiscount 隐藏入口）
      if (discount && discount > 0) {
        const __d = await checkPermission('receivable:discount')
        if (__d.code !== 0) return { code: 403, message: '无折价/减免权限' }
      }
      
      // T55-SC-7（graph二轮安全流）：amount 非数字（如 'abc'）原先落入 ||0 按 0 元处理，
      // 语义模糊。现显式校验：缺参→4001（原口径），非数字/负数/0→1001（参数错误，API 文档 §1.4）。
      if (!orderId || amount == null || amount === '') {
        return { code: 4001, message: '订单 ID 和收款金额为必填' }
      }
      const __amtNum = Number(amount)
      if (isNaN(__amtNum) || __amtNum <= 0) {
        return { code: 1001, message: '收款金额必须为大于 0 的数字' }
      }
      // T63-9：amount 与 discount 同口径分位归一（T59-R7C 备注项）——防 '60.005' 类输入直落库造成口径不对称
      amount = Math.round(__amtNum * 100) / 100
      
      // T57-RC-1：折价/减免同 amount 口径强校验。原实现 discount 直接落库：
      // 字符串 '5' 在 confirmPayment reduce(sum + (p.discount||0)) 时变字符串拼接（5+'5'=55），
      // 负数折价则虚增欠款。折价只允许 0（不填）或 >0 的有限数字。
      if (discount != null && discount !== '') {
        const __dNum = Number(discount)
        if (isNaN(__dNum) || __dNum < 0 || !isFinite(__dNum)) {
          return { code: 1001, message: '折价金额必须为不小于 0 的数字' }
        }
        if (__dNum > 0) discount = Math.round(__dNum * 100) / 100
      }
      
      const orderRes = await db.collection('orders').doc(orderId).get()
      const order = orderRes.data
      
      if (!order) {
        return { code: 4004, message: '订单不存在' }
      }
      
      // T57-RB-3：终态订单拒绝登记收款——已取消订单不应新增收款（原实现可对 cancelled 单收款，
      // 确认后会改其 payment_status 造成"取消单又有收款轨迹"的账务矛盾）
      if (order.status === 'cancelled') {
        return { code: 3002, message: '订单已取消，不可登记收款' }
      }
      if (order.status === 'completed' && (order.paymentStatus === 'paid' || (order.payment_status || 'unpaid') === 'paid')) {
        return { code: 3002, message: '订单已结清，无需收款' }
      }
      // 幂等键（T11 P2-3）：前端每次打开登记弹窗生成一个 clientToken；
      // 网络重试/双击带同一 token 进来 → 复用首次登记的 pending 记录，不重复生成
      const token = clientToken || `auto_${orderId}_${Date.now()}`
      const dupRes = await db.collection('payments')
        .where({ order_id: orderId, client_token: token })
        .limit(1)
        .get()
      if (dupRes.data.length > 0) {
        const first = dupRes.data[0]
        console.log('[collect] 幂等命中，复用已有 pending 记录', first._id)
        return { code: 0, data: { paymentId: first._id, reused: true } }
      }
      
      // 剩余欠款 = 订单金额 − 累计实收 − 累计折价/货损
      const received = order.received_amount || order.receivedAmount || 0
      const totalDiscount = order.total_discount || order.totalDiscount || 0
      // 已登记未确认的 pending 收款也占额：否则多笔待确认收款可累计超出剩余欠款
      // 用两个单字段等值查询分别取 orderId / order_id 再按 _id 去重，避免 or 链式 where 覆盖导致跨订单误统计
      let pendingCents = 0
      try {
        const q1 = await db.collection('payments').where({ orderId: orderId, status: 'pending' }).limit(100).get()
        const q2 = await db.collection('payments').where({ order_id: orderId, status: 'pending' }).limit(100).get()
        const seen = {}
        for (const p of [].concat(q1.data || [], q2.data || [])) {
          if (seen[p._id]) continue
          seen[p._id] = true
          // T62-V2：pending 占额必须含折价——只累加 amount 会让"收50+折60"类超额 pending 混过登记校验
          pendingCents += toCents(p.amount) + toCents(p.discount || 0)
        }
      } catch (e) { console.error('统计待确认收款失败', e) }
      const remainingC = Math.max(0, remainingCents(order.totalAmount || 0, received, totalDiscount) - pendingCents)
      // T62-V2：登记上限校验 = 实收+折价 合并占额（与 confirmPayment 超收拦截口径一致）。
      // 原实现只查 amount，"收50+折60>100" 被接受后写脏 total_discount + 留僵尸 pending，
      // 文案称"可作废"但仓库无作废 API，订单永远无法结清（graph R17 数据流 B-1 复现）
      if (toCents(amount) + toCents(discount || 0) > remainingC) {
        return { code: 4002, message: `收款金额+折价不能超过剩余欠款 ¥${(remainingC / 100).toFixed(2)}` }
      }
      
      // 登记收款：写入 payments（status=pending，待库管确认）；订单 unpaid→pending；实收在确认时才累加
      // 折价/货损：登记时即累加到订单 total_discount（前端登记时校验 金额+折价<=剩余欠款）
      if (discount && discount > 0) {
        try {
          const newDiscount = (order.total_discount || order.totalDiscount || 0) + discount
          await db.collection('orders').doc(orderId).update({
            data: {
              total_discount: newDiscount,
              totalDiscount: newDiscount,
              payment_status: 'pending',
              paymentStatus: 'pending'
            }
          })
        } catch (e) { console.error('累加折价失败', e) }
      }
      const payRes = await db.collection('payments').add({
        data: {
          order_id: orderId,
          orderId,
          customer_id: order.customerId,
          customerId: order.customerId,
          customer_name: order.customerName,
          customerName: order.customerName,
          amount,
          discount: discount || 0,
          method: paymentMethod || 'cash',
          note: note || '',
          status: 'pending',
          client_token: token,
          // T72：同 confirmed_by 口径对齐 impersonation（collect 场景同问题）
          registered_by: __impersonatedOpenid || (cloud.getWXContext() || {}).OPENID || '',
          registered_at: db.serverDate(),
          created_at: db.serverDate()
        }
      })
      
      // 订单状态：未收款 → 待确认（不改变实收金额，确认时再累加）
      // last_pending_payment_id（T11 P1-fix）：持久化最近一笔 pending，重试/排查可直接定位
      await db.collection('orders').doc(orderId).update({
        data: {
          payment_status: 'pending',
          paymentStatus: 'pending',
          last_pending_payment_id: payRes._id
        }
      })
      await appendOrderLog(orderId, 'collect', `登记收款 ¥${Number(amount).toFixed(2)}（待确认）`)
      
      return { code: 0, data: { paymentId: payRes._id } }
    }
    
    case 'confirmPayment': {
      const __p = await checkPermission('receivable:confirm'); if (__p.code !== 0) return __p
      // 确认收款（两步流程第二步；库管/管理员可）
      const { paymentId, orderId, note } = event
      
      let payRes
      if (paymentId) {
        payRes = await db.collection('payments').doc(paymentId).get()
      } else if (orderId) {
        // 兼容：按订单取最近一条待确认记录
        const list = await db.collection('payments')
          .where({ orderId, status: 'pending' })
          .orderBy('created_at', 'asc')
          .limit(1)
          .get()
        payRes = list.data.length > 0 ? { data: list.data[0] } : null
      }
      
      const pay = payRes && payRes.data
      if (!pay) {
        return { code: 4004, message: '待确认的收款记录不存在' }
      }
      
      const targetOrderId = pay.orderId || pay.order_id
      if (!targetOrderId) {
        return { code: 4001, message: '收款记录缺少订单 ID' }
      }
      
      // 幂等守卫（T11 P2-3）：已确认的收款重复确认 → 直接返回成功，不重复写日志/覆盖确认人
      if (pay.status === 'confirmed') {
        console.log('[confirmPayment] 幂等命中，该笔已确认', pay._id)
        return { code: 0, data: { reused: true } }
      }

      // T59-R9（P2 资金红线纵深防御）：确认前超收拦截。
      // collect 的 pending 占额校验是 get→check→add 非原子（TOCTOU），并发下可能挂出超额 pending；
      // 若超额 pending 被确认将造成 已收>应收 的超收错账（P0）。正常前端顺序操作不可触达，
      // 但确认时按 订单总额−已确认折价 设上限拦截是纯防御、不改变任何合法确认行为：
      // 已确认实收(不含本笔) + 本笔实收 + 已确认折价 + 本笔折价 > 订单总额 → 拒绝，payment 保持 pending 可回退。
      {
        const __ord = await db.collection('orders').doc(targetOrderId).get()
        const __o = __ord && __ord.data
        if (__o) {
          const __conf = await db.collection('payments').where({ orderId: targetOrderId, status: 'confirmed' }).get()
          const __confAmt = __conf.data.reduce((s, x) => s + toCents(x.amount || 0), 0)
          const __confDisc = __conf.data.reduce((s, x) => s + toCents(x.discount || 0), 0)
          const __totalC = toCents(__o.totalAmount || 0)
          const __thisAmtC = toCents(pay.amount || 0)
          const __thisDiscC = toCents(pay.discount || 0)
          if (__confAmt + __confDisc + __thisAmtC + __thisDiscC > __totalC) {
            console.log('[confirmPayment] 超收拦截：确认后实收+折价将超订单总额', { targetOrderId, conf: Math.round(__confAmt+__confDisc), this: Math.round(__thisAmtC+__thisDiscC), total: Math.round(__totalC) })
            return { code: 4002, message: '确认后收款将超过订单应收，已拦截（该笔保持待确认，可作废后重收）' }
          }
        }
      }
      
      // T50-2：并发防双记——条件更新仅当 status 仍为 pending 才翻 confirmed。
      // 原 get→update 两步非原子：两并发请求同时读到 pending 都通过守卫会双写 confirmed
      // （金额在重算口径下不会双计，但确认人/时间/日志会被第二笔覆盖，审计轨迹错乱）
      // T72：确认人取 __impersonatedOpenid || raw（对齐 checkPermission 口径）——
      // 原实现直用 raw OPENID，QA impersonation 模式下为空 → 审计字段 confirmed_by 落空串
      const __confirmerOid = __impersonatedOpenid || (cloud.getWXContext() || {}).OPENID
      const flip = await db.collection('payments').where({ _id: pay._id, status: 'pending' }).update({
        data: {
          status: 'confirmed',
          confirmed_by: __confirmerOid || '',
          confirmed_at: db.serverDate(),
          confirm_note: note || ''
        }
      })
      if (!flip.stats || !flip.stats.updated) {
        // 并发下另一请求已抢先确认 → 幂等返回，不重复记账
        console.log('[confirmPayment] 条件更新未命中（并发已确认），幂等返回', pay._id)
        return { code: 0, data: { reused: true } }
      }
      
      // 重算订单：received_amount = Σ已确认实收；payment_status = 结清则 paid，否则 pending
      const orderRes = await db.collection('orders').doc(targetOrderId).get()
      const order = orderRes.data
      if (order) {
        const confirmedList = await db.collection('payments')
          .where({ orderId: targetOrderId, status: 'confirmed' })
          .get()
        const confirmedAmount = confirmedList.data.reduce((sum, p) => sum + (p.amount || 0), 0)
        // 只认已确认折价（对齐原型 orderDiscount），不再用登记即累加的 total_discount
        const confirmedDiscount = confirmedList.data.reduce((sum, p) => sum + (p.discount || 0), 0)
        const total = order.totalAmount || 0
        const newStatus = remainingCents(total, confirmedAmount, confirmedDiscount) <= 0 ? 'paid' : 'pending'
        await db.collection('orders').doc(targetOrderId).update({
          data: {
            received_amount: confirmedAmount,
            receivedAmount: confirmedAmount,
            payment_status: newStatus,
            paymentStatus: newStatus,
            paymentConfirmedAt: db.serverDate(),
            paymentConfirmedBy: __impersonatedOpenid || (cloud.getWXContext() || {}).OPENID || '',
            paymentConfirmNote: note || ''
          }
        })
        await appendOrderLog(targetOrderId, 'confirm', `确认收款 ¥${Number(pay.amount || 0).toFixed(2)}`)
      }
      
      return { code: 0, data: {} }
    }
    
    case 'paymentHistory': {
      const __p = await checkPermission('receivable:view'); if (__p.code !== 0) return __p
      // 获取收款历史记录
      const { customerId, limit = 50 } = event
      // T63-3：customerId 必填——原实现缺参时静默返回全量流水（跨客户数据泄露面）
      if (!customerId) {
        return { code: 1001, message: 'customerId 参数必填' }
      }
      
      let query = db.collection('payments').orderBy('created_at', 'desc').limit(limit)
      
      query = query.where({ customerId })
      
      const res = await query.get()
      
      return {
        code: 0,
        data: {
          payments: res.data,
          totalCount: res.data.length
        }
      }
    }
    
    
    case 'pendingConfirm': {
      const __p = await checkPermission('receivable:confirm'); if (__p.code !== 0) return __p
      // 获取待确认收款列表（库管/管理员可见）
      const res = await db.collection('payments')
        .where({ status: 'pending' })
        .orderBy('registered_at', 'asc')
        .limit(50)
        .get()
      
      // 补充订单号和登记人信息
      const payments = await Promise.all(res.data.map(async (pay) => {
        const orderRes = await db.collection('orders').doc(pay.orderId).get()
        const order = orderRes.data || {}
        
        // 获取登记人信息
        let registeredBy = '未知'
        if (pay.registered_by) {
          const userRes = await db.collection('users').where({ openid: pay.registered_by }).get()
          if (userRes.data.length > 0) {
            registeredBy = userRes.data[0].name || '未知'
          }
        }
        
        return {
          ...pay,
          orderNo: order.orderNo || '未知订单',
          registeredBy,
          registeredAt: pay.registered_at ? new Date(pay.registered_at).toLocaleString('zh-CN') : ''
        }
      }))
      
      return {
        code: 0,
        data: payments
      }
    }
    case 'exportReceivable': {
      const __p = await checkPermission('report:export'); if (__p.code !== 0) return __p
      // 赊销报表双格式导出（行结构与前端 buildExportCsv 完全一致，口径复用 dashboard 聚合）
      const { viewTab, timeTab, format = 'csv', period, start, end } = event
      // 时间口径与前端导出预览一致：period 来自导出弹窗（all/today/week/month/custom）
      const dash = await exports.main({ action: 'dashboard', viewTab, timeTab: period || timeTab, searchKey: '', startDate: start, endDate: end, qaAsOpenid: event.qaAsOpenid }) // T47: 内层递归透传 QA 身份(对齐 report T42)，防 __impersonatedOpenid 被重置为空致 exportReceivable 401
      if (dash.code !== 0) return dash
      const customers = (dash.data && dash.data.customers) || []
      if (customers.length === 0) return { code: 0, data: { format: 'csv', csvContent: '', filename: '' } }

      const dateStr = () => { const d = bjNow(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
      const timeLabel = { all: '全部', today: '今日', week: '本周', month: '本月', custom: '自定义' }[period || timeTab] || (period || timeTab)
      const finalLabel = (period === 'custom' && start && end) ? ('自定义 (' + start + ' ~ ' + end + ')') : timeLabel
      const viewLabel = { ledger: '客户台账', unpaid: '未结清', settled: '已结清' }[viewTab] || viewTab
      const custReceivable = (c) => (c.orders || []).reduce((s, o) => s + (o.totalAmount || 0), 0)
      const custConfirmed = (c) => (c.orders || []).reduce((s, o) => s + (o.paidAmount || 0), 0)
      const custBalance = (c) => (c.orders || []).reduce((s, o) => s + (o.unpaidAmount || 0), 0)
      const payText = (ps) => ps === 'paid' ? '已结清' : (ps === 'pending' ? '未结清' : '未付款')

      const rows = []
      rows.push(['钱多多赊销报表'])
      rows.push(['导出时间：' + new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16)])
      rows.push(['筛选周期：' + finalLabel + ' · 视图：' + viewLabel])
      rows.push([])
      rows.push(['客户', '区域', '订单数', '总欠款(¥)', '状态', '最长欠款(天)', '已确认收款(¥)', '未收余额(¥)'])
      let grandTotal = 0, grandConfirmed = 0, grandBalance = 0
      customers.forEach(c => {
        const receivable = custReceivable(c), confirmed = custConfirmed(c), balance = custBalance(c)
        const hasPending = (c.orders || []).some(o => o.paymentStatus === 'pending')
        const status = balance <= 0.001 ? '已结清' : (hasPending ? '部分结清·待确认' : '未结清')
        grandTotal += receivable; grandConfirmed += confirmed; grandBalance += balance
        rows.push([c.name, c.region || '', c.orderCount, receivable.toFixed(2), status, c.maxAge > 0 ? c.maxAge : '', confirmed.toFixed(2), balance.toFixed(2)])
        ;(c.orders || []).forEach(o => {
          const oTotal = o.totalAmount || 0, oConfirmed = o.paidAmount || 0, oBalance = o.unpaidAmount || 0
          rows.push(['  └ ' + o.orderNo, '', '', oTotal.toFixed(2), payText(o.paymentStatus), oBalance > 0.001 ? (o.debtAgeDays || 0) : '', oConfirmed.toFixed(2), oBalance.toFixed(2)])
        })
      })
      rows.push([])
      rows.push(['合计', '', customers.length, grandTotal.toFixed(2), '', '', grandConfirmed.toFixed(2), grandBalance.toFixed(2)])
      rows.push([])
      rows.push(['周期汇总  应收总额：¥' + grandTotal.toFixed(2) + ' | 已收：¥' + grandConfirmed.toFixed(2) + ' | 未结清：¥' + grandBalance.toFixed(2)])

      const baseName = '钱多多赊销报表_' + dateStr()
      if (format === 'excel') {
        const ws = XLSX.utils.aoa_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '赊销报表')
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        const cloudPath = 'exports/' + baseName + '_' + Date.now() + '.xlsx'
        const up = await cloud.uploadFile({ cloudPath, fileContent: buffer })
        return { code: 0, data: { format: 'excel', fileID: up.fileID, filename: baseName + '.xlsx' } }
      }
      const csvContent = rows.map(r => r.map(c => {
        let s = (c === null || c === undefined) ? '' : String(c)
        if (/^[=+\-@]/.test(s)) s = "'" + s
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }).join(',')).join('\n')
      return { code: 0, data: { format: 'csv', csvContent, filename: baseName + '.csv' } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
  } catch (err) {
    console.error('[receivable] 未捕获异常 action=' + action, err && err.stack)
    return { code: 500, message: '服务器内部错误，请稍后重试' }
  }
}
