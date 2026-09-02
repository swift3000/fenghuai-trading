/**
 * 数据补齐云函数（幂等 upsert + 分批游标）
 * 从内置数据源（= 原型唯一真实数据源）向云端【补齐】缺失的客户/商品。
 * 语义：按 name 精确匹配——云端已存在则跳过，不存在才插入。
 * 不删除、不修改任何已有记录（订单引用不受影响），可安全重复执行。
 * 分批：offset/batch 游标，规避客户端 callFunction 5s 超时；权限：仅管理员。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { DEFAULT_CUSTOMERS } = require('./data')
const { DEFAULT_PRODUCTS } = require('./products')

async function checkAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return false
  const res = await db.collection('users').where({ openid: OPENID }).get()
  const user = res.data[0]
  // T55-SC-5：与业务侧 checkPermission 口径统一——禁用账号（status 非 active）一律拒绝
  return !!(user && user.role === 'admin' && (!user.status || user.status === 'active'))
}

async function fetchExistingNames(coll) {
  const names = new Set()
  let page = 0
  while (page < 10) {
    const res = await db.collection(coll).skip(page * 1000).limit(1000).get()
    for (const d of res.data) names.add(d.name)
    if (res.data.length < 1000) break
    page++
  }
  return names
}

async function syncBatch(coll, source, mapFn, offset, batch) {
  const existing = await fetchExistingNames(coll)
  const missing = source.filter(x => !existing.has(x.name))
  const slice = missing.slice(offset, offset + batch)
  let added = 0, failed = 0
  for (const x of slice) {
    try {
      await db.collection(coll).add({ data: mapFn(x) })
      added++
    } catch (e) { failed++; console.error('add failed', x.name, e.message) }
  }
  const processed = slice.length
  return {
    total: source.length,
    missingTotal: missing.length,
    offset,
    processed,
    added,
    failed,
    nextOffset: offset + processed,
    done: (offset + processed) >= missing.length
  }
}

const custMap = c => ({
  name: c.name, alias: c.alias || '', region: c.region || '',
  phone: c.phone || '', contact: c.contact || '',
  createdAt: db.serverDate(), updatedAt: db.serverDate()
})
const prodMap = p => ({
  material_code: p.material_code || '', name: p.name, spec: p.spec || '',
  pricing_mode: p.pricing_mode || 'case',
  unit_piece_qty: p.unit_piece_qty != null ? p.unit_piece_qty : 1,
  price_piece: p.price_piece != null ? p.price_piece : 0,
  price_unit: (p.price_unit != null ? p.price_unit : p.price_zero),
  unit: p.unit || '包', pinyin: p.pinyin || '',
  is_adjustable: p.is_adjustable != null ? p.is_adjustable : false,
  createdAt: db.serverDate(), updatedAt: db.serverDate()
})

exports.main = async (event, context) => {
  // T63-4：错误响应补统一 code（对齐其余云函数口径；success 保留向后兼容）
  if (!(await checkAdmin())) return { code: 403, success: false, message: '无权限：仅管理员可执行数据补齐' }
  const { action = 'sync-all', offset = 0, batch = 20 } = event
  try {
    if (action === 'sync-customers') return { code: 0, success: true, customers: await syncBatch('customers', DEFAULT_CUSTOMERS, custMap, offset, batch) }
    if (action === 'sync-products') return { code: 0, success: true, products: await syncBatch('products', DEFAULT_PRODUCTS, prodMap, offset, batch) }
    if (action === 'sync-all') {
      const c = await syncBatch('customers', DEFAULT_CUSTOMERS, custMap, offset, batch)
      const p = await syncBatch('products', DEFAULT_PRODUCTS, prodMap, offset, batch)
      return { code: 0, success: true, customers: c, products: p }
    }
    return { code: 1001, success: false, message: '未知操作：' + action }
  } catch (e) {
    console.error('sync failed', e)
    return { code: 5001, success: false, message: '补齐失败：' + e.message }
  }
}
