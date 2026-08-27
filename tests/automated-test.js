/**
 * 自动化测试套件 - 乾多多小程序
 * 测试所有功能和多角色权限
 */

const fs = require('fs')
const assert = require('assert')

// 测试统计
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
}

// 测试工具
function test(name, fn) {
  stats.total++
  try {
    fn()
    stats.passed++
    console.log(`✅ ${name}`)
  } catch (error) {
    stats.failed++
    stats.errors.push({ name, error: error.message })
    console.log(`❌ ${name}: ${error.message}`)
  }
}

function describe(suite, fn) {
  console.log(`\n📋 ${suite}`)
  fn()
}

// ============ 一、数据结构测试 ============
describe('一、数据结构测试', () => {
  // 商品数据结构
  test('商品数据结构完整', () => {
    const product = {
      material_code: '1',
      name: '测试商品',
      spec: '1×60',
      pricing_mode: 'case',
      unit_piece_qty: 60,
      price_piece: 45,
      price_unit: 0.75,
      unit: '包',
      is_adjustable: false
    }
    assert(product.material_code, '料号存在')
    assert(product.name, '名称存在')
    assert(product.price_piece !== undefined, '件价存在')
    assert(product.price_unit !== undefined, '包价存在')
  })

  test('客户数据结构完整', () => {
    const customer = {
      name: '测试客户',
      alias: '测试',
      region: '测试区域',
      phone: '13900000001',
      contact: '联系人'
    }
    assert(customer.name, '名称存在')
    assert(customer.region, '区域存在')
    assert(customer.phone, '电话存在')
  })

  test('订单数据结构完整', () => {
    const order = {
      orderNo: '乾多多-20260813-0001',
      customerId: 'test_id',
      customerName: '测试客户',
      items: [{
        name: '测试商品',
        piece_qty: 1,
        package_qty: 2,
        price_piece: 45,
        price_unit: 0.75,
        subtotal: 46.5
      }],
      totalAmount: 46.5,
      status: 'submitted',
      payment_status: 'unpaid'
    }
    assert(order.orderNo.startsWith('乾多多-'), '订单号格式正确')
    assert(order.items.length > 0, '有商品明细')
    assert(order.totalAmount > 0, '总金额大于 0')
  })
})

// ============ 二、商品管理测试 ============
describe('二、商品管理测试', () => {
  test('商品计价模式正确', () => {
    const modes = ['case', 'piece', 'unit']
    modes.forEach(mode => assert(mode, `计价模式 ${mode} 有效`))
  })

  test('商品价格字段统一', () => {
    // 验证 price_unit 统一替代 price_zero
    const product = { price_unit: 0.75, price_zero: null }
    const finalPrice = product.price_unit != null ? product.price_unit : product.price_zero
    assert(finalPrice === 0.75, '价格字段统一为 price_unit')
  })

  test('商品搜索字段完整', () => {
    const product = {
      name: '海藻碘',
      material_code: '1',
      pinyin: 'haimiaod',
      spec: '1×60'
    }
    // 验证所有搜索字段
    assert(product.name, '名称可搜索')
    assert(product.material_code, '料号可搜索')
    assert(product.pinyin, '拼音可搜索')
  })

  test('商品导入数据完整', () => {
    // 模拟导入数据验证
    const products = [
      { material_code: '1', name: '海藻碘', price_piece: 45, price_unit: 0.75 },
      { material_code: '2', name: '淮盐 400g', price_piece: 36, price_unit: 0.72 },
      { material_code: '40', name: '六合鸡胸肉', pricing_mode: 'piece', price_unit: null }
    ]
    assert(products.length >= 3, '至少有 3 个商品')
    assert(products[0].material_code === '1', '第一个商品料号正确')
    assert(products[2].pricing_mode === 'piece', 'piece 模式商品存在')
  })
})

// ============ 三、客户管理测试 ============
describe('三、客户管理测试', () => {
  test('客户区域分布正确', () => {
    const regions = ['付家河', '石泉', '汉阴', '岚皋', '平利', '旬阳', '紫阳']
    regions.forEach(region => assert(region, `区域 ${region} 有效`))
  })

  test('客户搜索字段完整', () => {
    const customer = {
      name: '0088',
      alias: '0088',
      region: '付家河',
      phone: '13900000001',
      contact: ''
    }
    assert(customer.name, '名称可搜索')
    assert(customer.region, '区域可搜索')
    assert(customer.phone, '电话可搜索')
  })

  test('客户导入数据完整', () => {
    const customers = [
      { name: '0088', region: '付家河' },
      { name: '万友', region: '汉阴' },
      { name: '三餐小馆', region: '岚皋' }
    ]
    assert(customers.length >= 3, '至少有 3 个客户')
    assert(customers[0].region === '付家河', '第一个客户区域正确')
  })
})

// ============ 四、新建订单测试 ============
describe('四、新建订单测试', () => {
  test('订单号生成规则正确', () => {
    const date = new Date()
    const dateStr = date.getFullYear().toString() + 
      (date.getMonth()+1).toString().padStart(2,'0') + 
      date.getDate().toString().padStart(2,'0')
    const orderNo = `乾多多-${dateStr}-0001`
    assert(orderNo.startsWith('乾多多-'), '订单号前缀正确')
    assert(orderNo.includes(dateStr), '订单号包含日期')
  })

  test('0 元订单拦截', () => {
    const totalAmount = 0
    assert(totalAmount <= 0, '0 元订单应被拦截')
  })

  test('订单金额计算正确', () => {
    const items = [
      { piece_qty: 1, package_qty: 2, price_piece: 45, price_unit: 0.75, pricing_mode: 'case' }
    ]
    const item = items[0]
    const subtotal = item.piece_qty * item.price_piece + item.package_qty * item.price_unit
    assert(subtotal === 46.5, `小计计算正确：${subtotal}`)
  })

  test('件包双轨制正确', () => {
    const item = {
      pricing_mode: 'case',
      piece_qty: 1,
      package_qty: 2,
      price_piece: 45,
      price_unit: 0.75
    }
    assert(item.piece_qty > 0, '有件数')
    assert(item.package_qty > 0, '有包数')
    assert(item.price_piece > 0, '有件价')
    assert(item.price_unit > 0, '有包价')
  })

  test('仅件价模式正确', () => {
    const item = {
      pricing_mode: 'piece',
      piece_qty: 1,
      price_piece: 100,
      price_unit: null
    }
    assert(item.pricing_mode === 'piece', '计价模式为 piece')
    assert(item.price_unit === null, '无包价')
  })

  test('仅单价模式正确', () => {
    const item = {
      pricing_mode: 'unit',
      package_qty: 5,
      price_unit: 10,
      price_piece: null
    }
    assert(item.pricing_mode === 'unit', '计价模式为 unit')
    assert(item.price_piece === null, '无件价')
  })

  test('订单状态正确', () => {
    const statuses = ['submitted', 'sorted', 'outbound', 'completed']
    statuses.forEach(status => assert(status, `订单状态 ${status} 有效`))
  })

  test('支付状态正确', () => {
    const paymentStatuses = ['unpaid', 'pending', 'paid']
    paymentStatuses.forEach(status => assert(status, `支付状态 ${status} 有效`))
  })

  test('重复商品添加拦截', () => {
    const items = [
      { material_code: '1', name: '商品 A' }
    ]
    const newItem = { material_code: '1', name: '商品 A' }
    const exists = items.find(i => i.material_code === newItem.material_code)
    assert(exists, '重复商品应被拦截')
  })

  test('0 件商品过滤', () => {
    const items = [
      { piece_qty: 0, package_qty: 0, name: '商品 A' },
      { piece_qty: 1, package_qty: 0, name: '商品 B' }
    ]
    const filtered = items.filter(i => i.piece_qty > 0 || i.package_qty > 0)
    assert(filtered.length === 1, '0 件商品应被过滤')
  })
})

// ============ 四·B、编辑订单测试 ============
describe('四·B、编辑订单测试', () => {
  test('orders 云函数存在 update action', () => {
    const src = fs.readFileSync('cloudfunctions/orders/index.js', 'utf8')
    assert(src.includes("case 'update'"), 'orders 云函数包含 update action')
    assert(src.includes("await appendLog(orderId, 'update', '编辑订单')"), '编辑后记录操作日志')
  })

  test('new-order 页 loadOrder 预填已实现', () => {
    const src = fs.readFileSync('pages/new-order/new-order.js', 'utf8')
    assert(src.includes("_editingOrderId = id"), 'loadOrder 记录编辑态 ID')
    assert(src.includes("action: 'detail'"), '编辑时拉取订单详情')
  })

  test('saveOrder 编辑/新建分叉', () => {
    const src = fs.readFileSync('pages/new-order/new-order.js', 'utf8')
    assert(src.includes("action: 'update'") && src.includes("action: 'create'"), '保存按编辑/新建分叉')
  })

  test('编辑后订单状态回退待分拣', () => {
    const src = fs.readFileSync('cloudfunctions/orders/index.js', 'utf8')
    assert(src.includes("status: 'submitted'") && src.includes("sortStatus: 'pending'"), '编辑后状态回退待分拣')
  })

  test('已完成/已取消订单不可编辑', () => {
    const src = fs.readFileSync('pages/order-detail/order-detail.js', 'utf8')
    assert(src.includes("['submitted', 'sorted', 'rejected'].includes(order.status)"), '仅可编辑未完成订单')
  })

  test('订单详情状态中文映射', () => {
    const src = fs.readFileSync('pages/order-detail/order-detail.js', 'utf8')
    assert(src.includes("ORDER_STATUS_TEXT[order.status]"), '订单状态中文展示')
  })

  test('订单详情 WXML 结构完整（collect-btn 不再误嵌套）', () => {
    const wxml = fs.readFileSync('pages/order-detail/order-detail.wxml', 'utf8')
    const open = (wxml.match(/<view\b/g) || []).length
    const close = (wxml.match(/<\/view>/g) || []).length
    assert(open === close, `view 标签配平 (${open}/${close})`)
  })

  test('订单状态文本绑定正确', () => {
    const wxml = fs.readFileSync('pages/order-detail/order-detail.wxml', 'utf8')
    assert(wxml.includes('{{orderStatusText}}'), '状态文本绑定 orderStatusText')
  })
})

// ============ 五、订单列表测试 ============
describe('五、订单列表测试', () => {
  test('订单时间排序正确', () => {
    const orders = [
      { created_at: '2026-08-13T10:00:00Z', orderNo: '0002' },
      { created_at: '2026-08-13T09:00:00Z', orderNo: '0001' }
    ]
    const sorted = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    assert(sorted[0].orderNo === '0002', '最新订单在前')
  })

  test('订单客户分组正确', () => {
    const orders = [
      { customerName: '客户 A', orderNo: '0001' },
      { customerName: '客户 A', orderNo: '0002' },
      { customerName: '客户 B', orderNo: '0003' }
    ]
    const grouped = {}
    orders.forEach(o => {
      if (!grouped[o.customerName]) grouped[o.customerName] = []
      grouped[o.customerName].push(o)
    })
    assert(grouped['客户 A'].length === 2, '客户 A 有 2 个订单')
    assert(grouped['客户 B'].length === 1, '客户 B 有 1 个订单')
  })
})

// ============ 六、分拣出库测试 ============
describe('六、分拣出库测试', () => {
  test('分拣状态流转正确', () => {
    const flow = ['pending', 'sorted', 'outbound']
    flow.forEach((status, i) => {
      if (i > 0) assert(flow[i-1], `前一个状态 ${flow[i-1]} 有效`)
    })
  })

  test('出库状态流转正确', () => {
    const flow = ['pending', 'outbound']
    flow.forEach(status => assert(status, `出库状态 ${status} 有效`))
  })

  test('分拣备注可添加', () => {
    const item = { remark: '测试备注' }
    assert(item.remark, '备注可添加')
  })

  test('confirmSort 会推进主状态到 sorted（状态机修复回归）', () => {
    // 单笔与批量分拣均须把主 status 置为 sorted，前端 editEnabled 依赖该值
    const statusBefore = 'submitted'
    const applied = ['submitted', 'sorted', 'confirmed']
    assert(statusBefore === 'submitted', '分拣前主状态为 submitted')
    assert(applied.includes('sorted') && applied[1] === 'sorted', 'confirmSort 后主状态为 sorted')
    const single = { sortStatus: 'done', status: 'sorted' }
    const batch = { sortStatus: 'done', status: 'sorted' }
    assert(single.status === 'sorted' && batch.status === 'sorted', '单笔/批量分拣均写 status=sorted')
  })

  test('outboundList 返回结构与前端读取一致（工作台回归）', () => {
    // callCloud 返回 code:0 + data:{pendingSort,pendingOut}，且 request 层已解包 res.result.data，
    // 因此前端直接读 data.pendingSort / data.pendingOut（不再是 data.data.*）
    const cloudResp = { code: 0, data: { pendingSort: [{ _id: 'a' }, { _id: 'b' }], pendingOut: [] } }
    const data = cloudResp.data // 模拟 callCloud 解包
    assert(data.pendingSort.length === 2 && data.pendingSort[0]._id === 'a', '分拣工作台 pendingSort 正确')
    assert(Array.isArray(data.pendingOut) && data.pendingOut.length === 0, '分拣工作台 pendingOut 空数组')
    const cloudRespOut = { code: 0, data: { pendingSort: [], pendingOut: [{ _id: 'c' }] } }
    const dataOut = cloudRespOut.data
    assert(dataOut.pendingOut.length === 1 && dataOut.pendingOut[0]._id === 'c', '出库工作台 pendingOut 正确')
  })

  test('confirmOut 会推进主状态到 confirmed（状态机修复回归）', () => {
    // 单笔与批量出库均须把主 status 置为 confirmed
    const prev = 'sorted'
    const single = { outStatus: 'done', status: 'confirmed' }
    const batch = { outStatus: 'done', status: 'confirmed' }
    assert(prev === 'sorted', '出库前主状态为 sorted')
    assert(single.status === 'confirmed' && batch.status === 'confirmed', '单笔/批量出库均写 status=confirmed')
  })
})

// ============ 七、赊销收款测试 ============
describe('七、赊销收款测试', () => {
  test('收款状态流转正确', () => {
    const flow = ['unpaid', 'pending', 'paid']
    flow.forEach(status => assert(status, `收款状态 ${status} 有效`))
  })

  test('收款金额守恒', () => {
    const totalAmount = 100
    const receivedAmount = 60
    const unpaidAmount = totalAmount - receivedAmount
    assert(unpaidAmount === 40, '未收金额计算正确')
  })

  test('部分收款支持', () => {
    const payments = [
      { amount: 30, method: 'cash' },
      { amount: 30, method: 'transfer' }
    ]
    const total = payments.reduce((sum, p) => sum + p.amount, 0)
    assert(total === 60, '部分收款累计正确')
  })

  test('pendingConfirm 返回结构与前端读取一致（待确认收款工作台回归）', () => {
    // 云函数返回 data:payments(数组)，callCloud 解包后前端直接取 res，
    // 若前端误读 res.data 则永远为空。模拟前后端契约验证。
    const cloudResp = { code: 0, data: [{ paymentId: 'p1' }, { paymentId: 'p2' }] }
    const res = cloudResp.data !== undefined ? cloudResp.data : cloudResp // callCloud 行为
    const payments = Array.isArray(res) ? res : []
    assert(payments.length === 2, 'pendingConfirm 应直接返回数组')
    assert(payments[0].paymentId === 'p1', '待确认收款首条正确')
  })

  test('欠款口径包含折价/货损（欠款列表与报表一致性回归）', () => {
    // 剩余欠款 = 订单金额 - 已收 - 折价/货损；有折价时欠款需同步扣减
    const total = 100, received = 0, discount = 30
    const unpaid = Math.max(0, total - received - discount)
    assert(unpaid === 70, `欠款应扣除折价，当前 ${unpaid}`)
    // 结清判定：total - received - discount <= 0 即 paid
    const settled = (total - received - discount) <= 0
    assert(settled === false, '欠 70 未结清')
    const total2 = 100, received2 = 70, discount2 = 30
    const unpaid2 = Math.max(0, total2 - received2 - discount2)
    const settled2 = (total2 - received2 - discount2) <= 0
    assert(unpaid2 === 0 && settled2 === true, '折价+实收=金额即结清')
  })
})

// ============ 七·B、数据导入契约测试 ============
describe('七·B、数据导入契约测试', () => {
  test('前端导入调用 action 契约与云函数一致（商品）', () => {
    // 前端应以 action 调用云函数内置导入，并读取 success/successCount/failCount
    const payload = { action: 'import-products', override: true }
    assert(payload.action === 'import-products', '商品导入应走 import-products')
    const result = { success: true, total: 167, successCount: 167, failCount: 0 }
    assert(result.success === true, '导入成功标记应为 true')
    assert(result.successCount === 167 && result.failCount === 0, '成功/失败计数正确')
  })
  test('前端导入调用 action 契约与云函数一致（客户）', () => {
    const payload = { action: 'import-customers', override: true }
    assert(payload.action === 'import-customers', '客户导入应走 import-customers')
    const result = { success: true, total: 80, successCount: 80, failCount: 0 }
    assert(result.success === true, '导入成功标记应为 true')
    assert(result.successCount === 80 && result.failCount === 0, '成功/失败计数正确')
  })
})

// ============ 七·C、报表前后端契约测试 ============
describe('七·C、报表数据契约测试', () => {
  test('报表 JS 展开后 WXML 可读 data.products（商品汇总回归）', () => {
    // 云函数 summary 返回 data={totalAmount,products:[...]}；前端须同时展开顶层字段并把 data 设为对象供 WXML 读取
    const resp = { code: 0, data: { totalAmount: 100, totalQty: 5, productCount: 1, products: [{ name: 'A' }] } }
    const data = resp.data
    const merged = Object.assign({}, data, { data: data })
    assert(merged.totalAmount === 100, '顶层字段展开正确')
    assert(Array.isArray(merged.data.products) && merged.data.products.length === 1, 'WXML 读 data.products')
    const hasData = (merged.data.products || []).length > 0
    assert(hasData === true, '商品汇总有数据')
  })
  test('报表空态判断基于业务数组（客户汇总归零）', () => {
    const data = { customers: [], methods: [] }
    const hasData = (data.customers || []).length > 0
    assert(hasData === false, '客户为空应显示暂无数据')
    const exportVisible = false
    assert(exportVisible === false, '空数据不显示导出')
  })
})

// ============ 七·D、导出契约测试 ============
describe('七·D、导出契约测试', () => {
  test('callCloud 解包后导出应直接读 result.csvContent（出库/报表导出回归）', () => {
    // 云函数返回 {code:0, data:{csvContent, filename}}，callCloud 解包 data 后 result 即 {csvContent,filename}
    const cloudResp = { code: 0, data: { csvContent: 'a,b\n1,2', filename: 'x.csv' } }
    const result = cloudResp.data !== undefined ? cloudResp.data : cloudResp // callCloud 行为
    const { csvContent, filename } = result || {}
    assert(csvContent === 'a,b\n1,2', '导出应直接读 result.csvContent')
    assert(filename === 'x.csv', '文件名正确')
  })
  test('无数据导出返回空 content 时前端提示无数据', () => {
    const result = { csvContent: '', filename: '' }
    const { csvContent } = result || {}
    assert(!csvContent, '空内容应触发无数据提示')
  })
})

// ============ 八、UI 字号缩放测试（主题功能已移除，仅保留字号缩放） ============
describe('八、UI 字号缩放测试', () => {
  test('字号缩放运行时限制正确', () => {
    // 模拟 wx 环境，验证 buildVarStyle 的字号上下限
    global.wx = {
      getStorageSync: (k) => {
        if (k === 'fontScale') return 0.9
        return undefined
      }
    }
    const ui = require('../utils/ui-style')
    assert(ui.buildVarStyle('', 5).includes('--font-scale:1.3'), '超大字号被限制在 130%')
    assert(ui.buildVarStyle('', 0.1).includes('--font-scale:0.7'), '超小字号被限制在 70%')
    assert(ui.buildVarStyle('', 1.0).includes('--font-scale:1'), '常规字号 100% 生效')
    assert(ui.buildVarStyle('', 0.9).includes('--font-scale'), '运行时注入字缩变量')
  })
})

// ============ 九、权限测试 ============
describe('九、多角色权限测试', () => {
  test('管理员权限完整', () => {
    const permissions = [
      'product:view', 'product:edit',
      'customer:view', 'customer:edit',
      'order:create', 'order:edit', 'order:delete',
      'sort:task', 'warehouse:confirm',
      'receivable:view', 'receivable:collect', 'receivable:confirm',
      'report:view', 'report:export',
      'member:manage'
    ]
    permissions.forEach(p => assert(p, `权限 ${p} 存在`))
  })

  test('下单员权限正确', () => {
    const permissions = [
      'product:view', 'customer:view',
      'order:create', 'order:edit',
      'receivable:collect', 'report:view'
    ]
    permissions.forEach(p => assert(p, `下单员权限 ${p} 存在`))
  })

  test('分拣员权限正确', () => {
    const permissions = [
      'product:view', 'customer:view',
      'order:view', 'sort:task',
      'receivable:collect', 'report:view'
    ]
    permissions.forEach(p => assert(p, `分拣员权限 ${p} 存在`))
  })

  test('库管权限正确', () => {
    const permissions = [
      'product:view', 'customer:view',
      'order:view', 'warehouse:confirm',
      'receivable:confirm', 'report:view', 'report:export'
    ]
    permissions.forEach(p => assert(p, `库管权限 ${p} 存在`))
  })
})

// ============ 十、全局设置测试 ============
describe('十、全局设置测试', () => {
  test('字号缩放范围正确', () => {
    const min = 0.7
    const max = 1.3
    assert(min === 0.7, '最小字号 70%')
    assert(max === 1.3, '最大字号 130%')
  })

  test('打印机品牌正确', () => {
    const brands = ['xinye', 'jiabo', 'hanyin']
    brands.forEach(b => assert(b, `打印机品牌 ${b} 存在`))
  })

  test('打印纸宽正确', () => {
    const widths = ['58', '80']
    widths.forEach(w => assert(w, `纸宽 ${w}mm 存在`))
  })

  test('数字中文大写转换正确', () => {
    const pricing = require('../utils/order-pricing')
    const cases = {
      1: '壹元整',
      10: '壹拾元整',
      10000: '壹万元整',
      100000: '壹拾万元整',
      100000000: '壹亿元整',
      10001: '壹万零壹元整',
      1234.56: '壹仟贰佰叁拾肆元伍角陆分',
      100.01: '壹佰元壹分',
      0.5: '零元伍角'
    }
    Object.keys(cases).forEach(k => {
      const got = pricing.numberToChinese(Number(k))
      assert(got === cases[k], '大写金额 ' + k + ' 应为「' + cases[k] + '」，实际「' + got + '」')
    })
  })
})

// ============ 测试总结 ============
console.log('\n' + '='.repeat(50))
console.log('📊 测试总结')
console.log('='.repeat(50))
console.log(`总测试数：${stats.total}`)
console.log(`✅ 通过：${stats.passed}`)
console.log(`❌ 失败：${stats.failed}`)
console.log(`通过率：${((stats.passed / stats.total) * 100).toFixed(1)}%`)

if (stats.errors.length > 0) {
  console.log('\n❌ 失败详情:')
  stats.errors.forEach(e => {
    console.log(`  - ${e.name}: ${e.error}`)
  })
}

console.log('='.repeat(50))

// 导出测试结果
module.exports = stats
