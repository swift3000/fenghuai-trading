/**
 * 数据导入云函数
 * 使用 wx-server-sdk 导入数据到云数据库
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { DEFAULT_CUSTOMERS } = require('./data')
const { DEFAULT_PRODUCTS } = require('./products')

// 管理员门禁：清空并重导入数据属破坏性操作，仅管理员可用（纵深防御，前端已用 canEdit 隐藏 UI）
async function checkAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return false
  const res = await db.collection('users').where({ openid: OPENID }).get()
  const user = res.data[0]
  // T55-SC-5：与业务侧 checkPermission 口径统一——禁用账号（status 非 active）一律拒绝
  return !!(user && user.role === 'admin' && (!user.status || user.status === 'active'))
}

exports.main = async (event, context) => {
  const { action = 'import' } = event

  // 所有动作（import-customers/import-products/import-all/verify）统一走管理员门禁
  if (!(await checkAdmin())) {
    return { success: false, message: '无权限：仅管理员可执行数据导入' }
  }
  try {
    if (action === 'import-customers') {
      return await importCustomers()
    }
    
    if (action === 'import-products') {
      return await importProducts()
    }
    
    if (action === 'import-all') {
      const customersResult = await importCustomers()
      const productsResult = await importProducts()
      return {
        success: true,
        message: '所有数据导入成功',
        customers: customersResult,
        products: productsResult
      }
    }
    
    if (action === 'verify') {
      return await verifyData()
    }
    
    return {
      success: false,
      message: '未知操作：' + action,
      availableActions: ['import-customers', 'import-products', 'import-all', 'verify']
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    return {
      success: false,
      message: '导入失败：' + error.message,
      error: error
    }
  }
}

async function importCustomers() {
  console.log('开始导入客户数据，总数:', DEFAULT_CUSTOMERS.length)
  
  // 彻底清空现有数据（分批删除）
  let totalDeleted = 0
  while (true) {
    const existing = await db.collection('customers').limit(1000).get()
    if (existing.data.length === 0) break
    
    for (const c of existing.data) {
      await db.collection('customers').doc(c._id).remove()
      totalDeleted++
    }
    console.log(`已删除 ${totalDeleted} 个客户`)
  }
  console.log(`客户表清空完成，共删除 ${totalDeleted} 条`)
  
  // 导入新数据
  const customersToAdd = DEFAULT_CUSTOMERS.map(c => ({
    name: c.name,
    alias: c.alias,
    region: c.region,
    phone: c.phone,
    contact: c.contact || ''
  }))
  
  let successCount = 0
  let failCount = 0
  
  for (const customer of customersToAdd) {
    try {
      await db.collection('customers').add({ data: customer })
      successCount++
    } catch (error) {
      console.error('导入客户失败:', customer.name, error)
      failCount++
    }
  }
  
  console.log('客户导入完成：成功', successCount, '失败', failCount)
  
  return {
    success: true,
    total: customersToAdd.length,
    successCount,
    failCount,
    message: `导入客户完成：成功 ${successCount} 条，失败 ${failCount} 条`
  }
}

async function importProducts() {
  console.log('开始导入商品数据，总数:', DEFAULT_PRODUCTS.length)
  
  // 彻底清空现有数据（分批删除）
  let totalDeleted = 0
  while (true) {
    const existing = await db.collection('products').limit(1000).get()
    if (existing.data.length === 0) break
    
    for (const p of existing.data) {
      await db.collection('products').doc(p._id).remove()
      totalDeleted++
    }
    console.log(`已删除 ${totalDeleted} 个商品`)
  }
  console.log(`商品表清空完成，共删除 ${totalDeleted} 条`)
  
  // 导入新数据
  const productsToAdd = DEFAULT_PRODUCTS.map(p => ({
    material_code: p.material_code,
    name: p.name,
    spec: p.spec,
    pricing_mode: p.pricing_mode,
    unit_piece_qty: p.unit_piece_qty,
    price_piece: p.price_piece,
    price_unit: (p.price_unit != null ? p.price_unit : p.price_zero),
    unit: p.unit,
    pinyin: p.pinyin || '',
    is_adjustable: p.is_adjustable
  }))
  
  let successCount = 0
  let failCount = 0
  
  for (const product of productsToAdd) {
    try {
      await db.collection('products').add({ data: product })
      successCount++
    } catch (error) {
      console.error('导入商品失败:', product.name, error)
      failCount++
    }
  }
  
  console.log('商品导入完成：成功', successCount, '失败', failCount)
  
  return {
    success: true,
    total: productsToAdd.length,
    successCount,
    failCount,
    message: `导入商品完成：成功 ${successCount} 条，失败 ${failCount} 条`
  }
}

async function verifyData() {
  console.log('开始验证数据...')
  
  const [customers, products] = await Promise.all([
    db.collection('customers').count({ limit: 1 }),
    db.collection('products').count({ limit: 1 })
  ])
  
  console.log('客户总数:', customers.total)
  console.log('商品总数:', products.total)
  
  // 获取样例数据
  const [sampleCustomer, sampleProduct] = await Promise.all([
    db.collection('customers').limit(1).get(),
    db.collection('products').limit(1).get()
  ])
  
  return {
    success: true,
    customers: {
      total: customers.total,
      sample: sampleCustomer.data[0] || null
    },
    products: {
      total: products.total,
      sample: sampleProduct.data[0] || null
    },
    message: `验证完成：客户 ${customers.total} 条，商品 ${products.total} 条`
  }
}
