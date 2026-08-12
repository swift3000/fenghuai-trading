/**
 * 修复数据库数据格式
 * 使用 wx-server-sdk 的数据库 API（与云函数一致）
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=#]+)=(.+)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

// 使用 @cloudbase/node-sdk（与云函数兼容）
const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({
  env: envVars.CLOUDBASE_ENV_ID,
  secretId: envVars.CLOUDBASE_SECRET_ID,
  secretKey: envVars.CLOUDBASE_SECRET_KEY
})

const db = app.database()

// 安全地解析 JS 数组格式的数据
function parseJsArray(content) {
  const match = content.match(/const DEFAULT_CUSTOMERS = (\[[\s\S]*?\]);/)
  if (!match) return null
  const fn = new Function('return ' + match[1])
  return fn()
}

function parseJsProducts(content) {
  const match = content.match(/const DEFAULT_PRODUCTS = (\[[\s\S]*?\]);/)
  if (!match) return null
  const fn = new Function('return ' + match[1])
  return fn()
}

async function fixData() {
  console.log('\n' + '='.repeat(60))
  console.log('🔧 开始修复数据库数据')
  console.log('='.repeat(60) + '\n')
  
  const customersPath = path.join(__dirname, '../原型/_DEFAULT_CUSTOMERS_generated.txt')
  const customersContent = fs.readFileSync(customersPath, 'utf8')
  const DEFAULT_CUSTOMERS = parseJsArray(customersContent)
  
  const productsPath = path.join(__dirname, '../原型/_DEFAULT_PRODUCTS_generated.txt')
  const productsContent = fs.readFileSync(productsPath, 'utf8')
  const DEFAULT_PRODUCTS = parseJsProducts(productsContent)
  
  console.log(`原型数据：${DEFAULT_CUSTOMERS.length} 个客户，${DEFAULT_PRODUCTS.length} 个商品\n`)
  
  // 1. 清空现有数据
  console.log('【步骤 1】清空现有数据...')
  try {
    const existingCustomers = await db.collection('customers').get()
    console.log(`   现有客户：${existingCustomers.data.length} 个`)
    for (const c of existingCustomers.data) {
      await db.collection('customers').doc(c._id).remove()
    }
    console.log('   ✅ 客户数据已清空')
    
    const existingProducts = await db.collection('products').get()
    console.log(`   现有商品：${existingProducts.data.length} 个`)
    for (const p of existingProducts.data) {
      await db.collection('products').doc(p._id).remove()
    }
    console.log('   ✅ 商品数据已清空')
  } catch (e) {
    console.log('   ❌ 清空失败:', e.message)
    return
  }
  
  // 2. 重新导入客户数据
  console.log('\n【步骤 2】重新导入客户数据...')
  let customerSuccess = 0
  let customerFail = 0
  
  for (const c of DEFAULT_CUSTOMERS) {
    try {
      const result = await db.collection('customers').add({
        data: {
          name: c.name,
          alias: c.alias,
          shortName: c.alias,
          contact: c.contact || '',
          phone: c.phone,
          region: c.region,
          description: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      customerSuccess++
    } catch (err) {
      console.error(`   导入客户 ${c.name} 失败:`, err.message)
      customerFail++
    }
  }
  
  console.log(`   客户导入完成：成功 ${customerSuccess}, 失败 ${customerFail}`)
  
  // 3. 重新导入商品数据
  console.log('\n【步骤 3】重新导入商品数据...')
  let productSuccess = 0
  let productFail = 0
  
  for (const p of DEFAULT_PRODUCTS) {
    try {
      const unit = p.pricing_mode === 'case' ? '包' : (p.pricing_mode === 'piece' ? '件' : p.unit)
      
      await db.collection('products').add({
        data: {
          material_code: p.material_code,
          name: p.name,
          spec: p.spec,
          pricing_mode: p.pricing_mode,
          unit_piece_qty: p.unit_piece_qty,
          price_piece: p.price_piece,
          price_unit: (p.price_unit != null ? p.price_unit : p.price_zero),
          unit: unit,
          pinyin: p.pinyin || '',
          is_adjustable: p.is_adjustable,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      productSuccess++
    } catch (err) {
      productFail++
    }
  }
  
  console.log(`   商品导入完成：成功 ${productSuccess}, 失败 ${productFail}`)
  
  // 4. 验证数据
  console.log('\n【步骤 4】验证数据...')
  try {
    const customers = await db.collection('customers').limit(1).get()
    console.log(`   客户总数：${customers.data.length} 个`)
    if (customers.data.length > 0) {
      const c = customers.data[0]
      console.log('   字段检查:', Object.keys(c).join(', '))
      console.log('   示例数据:', c.name, '|', c.alias, '|', c.phone)
    }
    
    const products = await db.collection('products').limit(1).get()
    console.log(`   商品总数：${products.data.length} 个`)
    if (products.data.length > 0) {
      const p = products.data[0]
      console.log('   字段检查:', Object.keys(p).join(', '))
      console.log('   示例数据:', p.name, '|', p.material_code, '|', p.price_piece)
    }
  } catch (e) {
    console.log('   ❌ 验证失败:', e.message)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ 数据修复完成！')
  console.log('='.repeat(60) + '\n')
}

fixData()
