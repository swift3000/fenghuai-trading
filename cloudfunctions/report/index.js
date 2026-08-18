const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null

const XLSX = require('xlsx')

// 由二维数组生成 xlsx buffer（数字列保持数值，文本保持文本）
function buildXlsxBuffer(rows, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows || [])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// 导出内容统一出口：format=excel 时生成 xlsx 上传云存储返回 fileID；否则返回 csvContent
async function buildExport(rows, baseName, opts) {
  const fmt = opts.format === 'excel' ? 'excel' : 'csv'
  if (fmt === 'excel') {
    const buffer = buildXlsxBuffer(rows, opts.sheetName || 'Sheet1')
    const safeName = String(baseName || 'export').replace(/[\/\/]+/g, '')
    const cloudPath = 'exports/' + safeName + '_' + Date.now() + '.xlsx'
    const up = await cloud.uploadFile({ cloudPath, fileContent: buffer })
    return { format: 'excel', fileID: up.fileID, filename: safeName + '.xlsx' }
  }
  const csvContent = (rows || []).map(row => (row || []).map(c => {
    let v = c === null || c === undefined ? '' : String(c)
    if (/^[=+\-@]/.test(v)) v = "'" + v
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }).join(',')).join('\n')
  return { format: 'csv', csvContent, filename: baseName + '.csv' }
}

// 权限校验
async function checkPermission(permission) {
  const { OPENID: __rawOID } = cloud.getWXContext()
  const OPENID = __impersonatedOpenid || __rawOID
  if (!OPENID) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0 }
  }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
  if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }

  if (user.role === 'admin') return { code: 0 }
  if (user.permissions && user.permissions.includes(permission)) return { code: 0 }
  return { code: 403, message: '无权限访问' }
}


// 公司名（用于导出标题；云函数无法 require 前端 constants）
const COMPANY_NAME = '丰淮商贸'

// 按时间+区域获取订单（供专用导出使用；同时返回 payments 用于收款台账）
async function getFilteredOrdersFull(timeTab, region, customStart, customEnd) {
  const now = new Date()
  let dateFilter = null
  if (timeTab === 'day') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    dateFilter = { created_at: db.command.and([db.command.gte(start), db.command.lte(end)]) }
  } else if (timeTab === 'week') {
    const day = now.getDay() || 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    dateFilter = { created_at: db.command.and([db.command.gte(start), db.command.lte(end)]) }
  } else if (timeTab === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    dateFilter = { created_at: db.command.and([db.command.gte(start), db.command.lte(end)]) }
  } else if (timeTab === 'custom' && customStart && customEnd) {
    const start = new Date(customStart); start.setHours(0,0,0,0)
    const end = new Date(customEnd); end.setHours(23,59,59,999)
    dateFilter = { created_at: db.command.and([db.command.gte(start), db.command.lte(end)]) }
  }
  // 合并多条件为单次 where：Query.where() 会整体替换旧条件而非合并
  const conds = []
  if (dateFilter) conds.push(dateFilter)
  if (region) conds.push({ customerRegion: region })
  let query = db.collection('orders')
  if (conds.length === 1) query = query.where(conds[0])
  else if (conds.length > 1) query = query.where(db.command.and(conds))
  const res = await query.orderBy('created_at', 'desc').get()
  const orders = res.data
  // 关联各订单的已确认收款，注入 o.payments 供 buildLedgerData 使用（收款存独立 payments 集合）
  const ids = orders.map(o => o._id).filter(Boolean)
  if (ids.length > 0) {
    try {
      const payRes = await db.collection('payments').where({
        orderId: db.command.in(ids),
        status: 'confirmed'
      }).get()
      const byOrder = {}
      payRes.data.forEach(p => {
        if (!byOrder[p.orderId]) byOrder[p.orderId] = []
        byOrder[p.orderId].push(p)
      })
      orders.forEach(o => { if (byOrder[o._id]) o.payments = byOrder[o._id] })
    } catch (e) { console.error('关联订单收款失败', e) }
  }
  return orders
}

// 单个商品金额
function itemAmount(it) {
  const mode = it.pricing_mode || 'case'
  const pieceQty = it.piece_qty || 0
  const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
  const pricePiece = it.price_piece || 0
  const priceUnit = it.price_unit != null ? it.price_unit : it.price_zero || 0
  if (mode === 'piece') return pieceQty * pricePiece
  if (mode === 'unit') return packageQty * priceUnit
  return pieceQty * pricePiece + packageQty * priceUnit
}

// 收款台账数据（对标原型 buildLedgerData）
function buildLedgerData(orders) {
  const rows = orders.filter(o => (o.totalAmount || 0) > 0).map((o, i) => {
    let zheng = 0, sun = 0
    ;(o.items || []).forEach(it => {
      const amt = itemAmount(it)
      if (it.pricing_mode === 'case' || it.pricing_mode === 'piece') zheng += amt
      else sun += amt
    })
    const actual = zheng - sun
    const payments = o.payments || []
    const confirmed = payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + (p.amount || 0), 0)
    const m = (p) => (p.method || p.paymentMethod || '其他')
    const cash = payments.filter(p => p.status === 'confirmed' && ['现金','cash'].includes(m(p))).reduce((sum, p) => sum + (p.amount || 0), 0)
    const wechat = payments.filter(p => p.status === 'confirmed' && ['微信','wechat'].includes(m(p))).reduce((sum, p) => sum + (p.amount || 0), 0)
    // 折价/货损(collect 登记的 total_discount)独立于实收现金，欠款 = 实际货值 - 实收 - 累计折价（与赊销 dashboard/order-detail 口径一致）
    const discount = o.total_discount || o.totalDiscount || 0
    const debt = Math.max(0, actual - confirmed - discount)
    const recvDates = payments.filter(p => p.status === 'confirmed').map(p => p.confirmed_at || p.paid_at || '').filter(Boolean).sort()
    const recvDate = recvDates.length ? recvDates[recvDates.length - 1] : ''
    const big = o.ship_large || 0, medium = o.ship_medium || 0, small = o.ship_small || 0
    const pkgs = big + medium + small
    return { no: i + 1, time: o.created_at ? String(o.created_at).slice(0, 10) : '', region: o.customerRegion || '', customer: o.customerName, zheng, sun, actual, debt, confirmed, cash, wechat, recvDate, pkgs, big, medium, small }
  })
  const totals = rows.reduce((t, r) => {
    t.zheng += r.zheng; t.sun += r.sun; t.actual += r.actual; t.debt += r.debt; t.confirmed += r.confirmed; t.cash += r.cash; t.wechat += r.wechat; t.pkgs += r.pkgs; t.big += r.big; t.medium += r.medium; t.small += r.small
    return t
  }, { zheng: 0, sun: 0, actual: 0, debt: 0, confirmed: 0, cash: 0, wechat: 0, pkgs: 0, big: 0, medium: 0, small: 0 })
  return { rows, totals }
}

// 0 值不显示：导出件数为 0 时留空（与界面口径一致）
function pkShow(v) { return Number(v) > 0 ? Number(v) : '' }
function sanitizeCell(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  // 防 CSV 公式注入：Excel 打开时将 = + - @ 开头的单元格前缀 ' 转文本
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return s
}
function toCSV(rows) {
  return rows.map(row => {
    return (row || []).map(c => {
      const s = sanitizeCell(c)
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }).join(',')
  }).join('\n')
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const { action } = event
  switch (action) {
    case 'summary': {
      const __p = await checkPermission('report:view'); if (__p.code !== 0) return __p
      const { reportTab, timeTab, region, startDate: customStart, endDate: customEnd } = event
      const now = new Date()
      
      // 时间范围过滤
      let dateFilter = null
      if (timeTab === 'custom' && customStart && customEnd) {
        const start = new Date(customStart); start.setHours(0,0,0,0)
        const end = new Date(customEnd); end.setHours(23,59,59,999)
        dateFilter = { created_at: db.command.and([db.command.gte(start), db.command.lte(end)]) }
      } else if (timeTab === 'day') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'week') {
        const day = now.getDay() || 7
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
        start.setHours(0,0,0,0)
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      } else if (timeTab === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        dateFilter = {
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }
      }
      // 区域过滤
      const regionFilter = region ? { customerRegion: region } : null
      
      if (reportTab === 'product') {
        // 商品汇总统计
        // 合并多条件为单次 where：Query.where() 会整体替换旧条件而非合并
        const conds = []
        if (dateFilter) conds.push(dateFilter)
        if (regionFilter) conds.push(regionFilter)
        let query = db.collection('orders')
        if (conds.length === 1) query = query.where(conds[0])
        else if (conds.length > 1) query = query.where(db.command.and(conds))
        
        const ordersResult = await query.get()
        const orders = ordersResult.data
        
        // 按商品聚合统计
        const productMap = {}
        orders.forEach(order => {
          const items = order.items || []
          items.forEach(item => {
            const key = item._id || item.name
            if (!productMap[key]) {
              productMap[key] = {
                _id: key,
                name: item.name,
                spec: item.spec || '',
                totalQty: 0,
                totalAmount: 0,
                orderCount: 0
              }
            }
            // 新订单已归一化含 amount；旧数据回退用 件×件价+包×包价
            let rowAmount = item.amount != null ? item.amount : 0
            if (rowAmount === 0) {
              const mode = item.pricing_mode || 'case'
              const pieceQty = item.piece_qty || 0
              const packageQty = item.package_qty != null ? item.package_qty : item.zero_qty || 0
              if (mode === 'piece') rowAmount = pieceQty * (item.price_piece || 0)
              else if (mode === 'unit') rowAmount = packageQty * (item.price_unit != null ? item.price_unit : item.price_zero || 0)
              else rowAmount = pieceQty * (item.price_piece || 0) + packageQty * (item.price_unit != null ? item.price_unit : item.price_zero || 0)
            }
            productMap[key].totalQty += item.qty || (Math.max(item.piece_qty || 0, item.package_qty != null ? item.package_qty : item.zero_qty || 0))
            productMap[key].totalAmount += rowAmount
            productMap[key].orderCount += 1
          })
        })
        
        let products = Object.values(productMap)
        // 按销售额降序排序
        products.sort((a, b) => b.totalAmount - a.totalAmount)
        
        // 计算总计
        const totalAmount = products.reduce((sum, p) => sum + p.totalAmount, 0)
        const totalQty = products.reduce((sum, p) => sum + p.totalQty, 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            totalQty,
            productCount: products.length,
            products
          }
        }
      } else if (reportTab === 'customer') {
        // 客户汇总统计
        // 合并多条件为单次 where：Query.where() 会整体替换旧条件而非合并
        const conds = []
        if (dateFilter) conds.push(dateFilter)
        if (regionFilter) conds.push(regionFilter)
        let query = db.collection('orders')
        if (conds.length === 1) query = query.where(conds[0])
        else if (conds.length > 1) query = query.where(db.command.and(conds))
        
        const ordersResult = await query.get()
        const orders = ordersResult.data
        
        // 按客户聚合统计
        const customerMap = {}
        orders.forEach(order => {
          const customerId = order.customerId
          if (!customerId) return  // 脏数据防护：无 customerId 的孤儿订单不参与客户聚合
          if (!customerMap[customerId]) {
            customerMap[customerId] = {
              _id: customerId,
              name: order.customerName,
              region: order.customerRegion || '',
              totalAmount: 0,
              paidAmount: 0,
              unpaidAmount: 0,
              orderCount: 0,
              itemCount: 0
            }
          }
          const customer = customerMap[customerId]
          const received = order.received_amount || order.receivedAmount || 0
          customer.totalAmount += order.totalAmount || 0
          customer.paidAmount += received
          customer.unpaidAmount += Math.max(0, (order.totalAmount || 0) - received - (order.total_discount || order.totalDiscount || 0))
          customer.orderCount += 1
          customer.itemCount += (order.items || []).length
        })
        
        let customers = Object.values(customerMap)
        // 按采购金额降序排序
        customers.sort((a, b) => b.totalAmount - a.totalAmount)
        
        // 计算总计
        const totalAmount = customers.reduce((sum, c) => sum + c.totalAmount, 0)
        const totalOrders = customers.reduce((sum, c) => sum + c.orderCount, 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            totalOrders,
            customerCount: customers.length,
            customers
          }
        }
      } else if (reportTab === 'payment') {
        // 收款台账统计
        let query = db.collection('payments')
        if (dateFilter) {
          query = query.where(dateFilter)
        }
        
        const paymentsResult = await query.orderBy('created_at', 'desc').get()
        let payments = paymentsResult.data
        // 区域过滤（收款记录需回查订单区域）
        if (region) {
          const filtered = []
          for (const pay of payments) {
            try {
              const oid = pay.orderId || pay.order_id
              if (!oid) continue
              const oRes = await db.collection('orders').doc(oid).get()
              if (oRes.data && oRes.data.customerRegion === region) filtered.push(pay)
            } catch (e) {}
          }
          payments = filtered
        }
        
        // 按收款方式统计
        const methodMap = {}
        payments.forEach(payment => {
          const method = payment.method || payment.paymentMethod || '其他'
          if (!methodMap[method]) {
            methodMap[method] = {
              method,
              count: 0,
              amount: 0
            }
          }
          methodMap[method].count += 1
          methodMap[method].amount += payment.amount || 0
        })
        
        const methods = Object.values(methodMap)
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
        
        return {
          code: 0,
          data: {
            totalAmount,
            paymentCount: payments.length,
            methods
          }
        }
      }
      
      return { code: 5001, message: '不支持的报表类型' }
    }
    
    case 'trend': {
      const __p = await checkPermission('report:view'); if (__p.code !== 0) return __p
      // 销售趋势分析
      const { days = 7 } = event
      const now = new Date()
      
      const trendData = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
        
        const ordersResult = await db.collection('orders').where({
          created_at: db.command.and([
            db.command.gte(start),
            db.command.lte(end)
          ])
        }).get()
        
        const orders = ordersResult.data
        const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        const orderCount = orders.length
        
        trendData.push({
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          amount: totalAmount,
          count: orderCount
        })
      }
      
      return {
        code: 0,
        data: {
          trendData,
          days
        }
      }
    }
    
    case 'export': {
      const __p = await checkPermission('report:export'); if (__p.code !== 0) return __p
      // 导出报表数据
      const { reportTab, timeTab, region, startDate, endDate, format = 'csv' } = event

      // 获取统计数据（透传 region + 自定义时间区间，与报表页筛选一致）
      const summaryResult = await exports.main({
        action: 'summary',
        reportTab,
        timeTab,
        region,
        startDate,
        endDate
      }, context)

      const data = summaryResult.data || {}
      const rangeTag = (timeTab === 'custom' && startDate && endDate) ? (startDate + '_' + endDate) : timeTab

      // 生成 CSV 内容（统一走 toCSV，防 = + - @ 公式注入 + 引号转义）
      let csvRows = []
      if (reportTab === 'product') {
        csvRows = [['商品名称', '规格', '数量', '金额', '订单数']]
        ;(data.products || []).forEach(p => {
          csvRows.push([p.name, p.spec || '', p.totalQty, (p.totalAmount||0).toFixed(2), p.orderCount])
        })
      } else if (reportTab === 'customer') {
        csvRows = [['客户名称', '区域', '订单数', '商品数', '采购金额', '已收款', '欠款']]
        ;(data.customers || []).forEach(c => {
          csvRows.push([c.name, c.region || '', c.orderCount, c.itemCount, (c.totalAmount||0).toFixed(2), (c.paidAmount||0).toFixed(2), (c.unpaidAmount||0).toFixed(2)])
        })
      } else if (reportTab === 'payment') {
        csvRows = [['收款方式', '笔数', '金额']]
        ;(data.methods || []).forEach(m => {
          csvRows.push([m.method, m.count, (m.amount||0).toFixed(2)])
        })
      }
      const csvContent = csvRows.length ? toCSV(csvRows) : ''

      if (!csvRows.length) return { code: 0, data: { format: 'csv', csvContent: '', filename: '' } }
      if (format === 'excel') {
        const out = await buildExport(csvRows, '报表_' + reportTab + '_' + rangeTag, { format, sheetName: '报表' })
        return { code: 0, data: out }
      }
      return {
        code: 0,
        data: {
          format: 'csv',
          csvContent,
          filename: '报表_' + reportTab + '_' + rangeTag + '_' + Date.now() + '.csv'
        }
      }
    }
    
    case 'exportDailySummary': {
      const __p = await checkPermission('report:export'); if (__p.code !== 0) return __p
      // 客户汇总表（外县台账式）导出
      const { timeTab, region, startDate, endDate, format = 'csv' } = event
      const orders = await getFilteredOrdersFull(timeTab, region, startDate, endDate)
      if (orders.length === 0) return { code: 0, data: { format: 'csv', csvContent: '', filename: '' } }

      const byCustomer = {}
      orders.forEach(o => {
        const key = o.customerName
        if (!byCustomer[key]) byCustomer[key] = { customer: o.customerName, region: o.customerRegion || '', rows: [] }
        const time = o.created_at ? new Date(o.created_at).toTimeString().slice(0, 5) : ''
        const date = o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : ''
        ;(o.items || []).forEach(it => {
          const remark = it.remark || ''
          let pieceQty = Number(it.piece_qty || 0)
          let zeroQty = Number(it.package_qty != null ? it.package_qty : it.zero_qty || 0)
          // 旧格式回退：无 piece_qty/package_qty 但有 qty/price → 按 件×单价
          const legacy = (pieceQty<=0 && zeroQty<=0 && (it.qty||0)>0)
          if (legacy) { pieceQty = Number(it.qty) }
          const unitPricePiece = legacy ? (Number(it.price)||0) : (it.price_piece||0)
          if (pieceQty > 0) {
            const amt = pieceQty * unitPricePiece
            byCustomer[key].rows.push([date, o.customerRegion || '', o.customerName, it.name, '件', pieceQty, unitPricePiece.toFixed(2), amt.toFixed(2), remark])
          }
          if (zeroQty > 0) {
            const unitPrice = it.price_unit != null ? it.price_unit : it.price_zero || 0
            const amt = zeroQty * unitPrice
            byCustomer[key].rows.push([date, o.customerRegion || '', o.customerName, it.name, '包', zeroQty, unitPrice.toFixed(2), amt.toFixed(2), remark])
          }
        })
      })

      let rangeDesc = timeTab === 'day' ? todayTxt() : (timeTab === 'week' ? '本周' : (timeTab === 'month' ? '本月' : (startDate + ' 至 ' + endDate)))
      const csvRows = [[COMPANY_NAME + ' 客户汇总表（' + rangeDesc + '）'], [], ['编号', '时间', '区域', '客户', '商品', '单位', '数量', '单价', '金额', '备注']]
      let no = 1
      let grandTotal = 0
      Object.values(byCustomer).forEach(c => {
        let subTotal = 0
        c.rows.forEach((r, idx) => {
          subTotal += parseFloat(r[7]) || 0
          csvRows.push([idx === 0 ? no : '', r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]])
        })
        csvRows.push(['', '', '', '', '', '', '', '小计', subTotal.toFixed(2), ''])
        csvRows.push([])
        grandTotal += subTotal
        no++
      })
      csvRows.push(['', '', '', '', '', '', '', '合计', grandTotal.toFixed(2), ''])
      if (format === 'excel') {
        const out = await buildExport(csvRows, COMPANY_NAME + '_客户汇总表_' + String(rangeDesc).replace(/\//g, ''), { format, sheetName: '客户汇总表' })
        return { code: 0, data: out }
      }
      return { code: 0, data: { format: 'csv', csvContent: toCSV(csvRows), filename: COMPANY_NAME + '_客户汇总表_' + String(rangeDesc).replace(/\//g, '') + '.csv' } }
    }

    case 'exportLedger': {
      const __p = await checkPermission('report:export'); if (__p.code !== 0) return __p
      // 收款台账（外县格式）导出
      const { timeTab, region, startDate, endDate, format = 'csv' } = event
      const orders = await getFilteredOrdersFull(timeTab, region, startDate, endDate)
      const { rows, totals } = buildLedgerData(orders)
      if (rows.length === 0) return { code: 0, data: { format: 'csv', csvContent: '', filename: '' } }

      let rangeDesc = timeTab === 'day' ? todayTxt() : (timeTab === 'week' ? '本周' : (timeTab === 'month' ? '本月' : (startDate + ' 至 ' + endDate)))
      const title = COMPANY_NAME + rangeDesc + '外县收款台账'
      const header = ['编号', '时间', '区域', '客户', '正价货', '损赠特', '实际货值', '赊销', '实收金额', '现余', '微信', '收款日期', '大件', '中件', '小件', '件数']
      const csvRows = [[title], [], header]
      rows.forEach(r => {
        csvRows.push([r.no, r.time, r.region, r.customer, r.zheng.toFixed(2), r.sun.toFixed(2), r.actual.toFixed(2), r.debt.toFixed(2), r.confirmed.toFixed(2), r.cash.toFixed(2), r.wechat.toFixed(2), r.recvDate ? String(r.recvDate).slice(0, 10) : '', pkShow(r.big), pkShow(r.medium), pkShow(r.small), pkShow(r.pkgs)])
      })
      csvRows.push([])
      csvRows.push(['合计', '', '', '', totals.zheng.toFixed(2), totals.sun.toFixed(2), totals.actual.toFixed(2), totals.debt.toFixed(2), totals.confirmed.toFixed(2), totals.cash.toFixed(2), totals.wechat.toFixed(2), '', pkShow(totals.big), pkShow(totals.medium), pkShow(totals.small), pkShow(totals.pkgs)])
      csvRows.push(['总件数', totals.pkgs])
      if (format === 'excel') {
        const out = await buildExport(csvRows, COMPANY_NAME + '_收款台账_' + String(rangeDesc).replace(/\//g, ''), { format, sheetName: '收款台账' })
        return { code: 0, data: out }
      }
      return { code: 0, data: { format: 'csv', csvContent: toCSV(csvRows), filename: COMPANY_NAME + '_收款台账_' + String(rangeDesc).replace(/\//g, '') + '.csv' } }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}

// 今日日期字符串
function todayTxt() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

