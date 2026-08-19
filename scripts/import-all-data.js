const fs = require('fs')
const path = require('path')

// 读取.env 文件
const envPath = path.join(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=#]+)=(.+)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

// 初始化云开发
const cloud = require('@cloudbase/node-sdk')
const app = cloud.init({
  env: envVars.CLOUDBASE_ENV_ID,
  secretId: envVars.CLOUDBASE_SECRET_ID,
  secretKey: envVars.CLOUDBASE_SECRET_KEY
})
const db = app.database()

// 安全地解析 JS 数组格式的数据
function parseJsArray(content) {
  // 提取数组部分
  const match = content.match(/const DEFAULT_CUSTOMERS = (\[[\s\S]*?\]);/)
  if (!match) {
    return null
  }
  
  // 使用 Function 来解析 JS 对象数组
  const fn = new Function('return ' + match[1])
  return fn()
}

function parseJsProducts(content) {
  const match = content.match(/const DEFAULT_PRODUCTS = (\[[\s\S]*?\]);/)
  if (!match) {
    return null
  }
  
  const fn = new Function('return ' + match[1])
  return fn()
}

// 导入客户数据
async function importCustomers() {
  console.log('开始导入客户数据...')
  
  // 读取原型数据
  const customersPath = path.join(__dirname, '../docs/ui/_DEFAULT_CUSTOMERS_generated.txt')
  const customersContent = fs.readFileSync(customersPath, 'utf8')
  const DEFAULT_CUSTOMERS = parseJsArray(customersContent)
  
  if (!DEFAULT_CUSTOMERS) {
    console.error('无法解析客户数据')
    return
  }
  
  console.log(`找到 ${DEFAULT_CUSTOMERS.length} 个客户`)
  
  // 清空现有客户数据
  console.log('清空现有客户数据...')
  const existingCustomers = await db.collection('customers').get()
  if (existingCustomers.data.length > 0) {
    console.log(`删除 ${existingCustomers.data.length} 个现有客户`)
    for (const customer of existingCustomers.data) {
      await db.collection('customers').doc(customer._id).remove()
    }
  }
  
  // 导入新客户数据
  let successCount = 0
  let failCount = 0
  
  for (const c of DEFAULT_CUSTOMERS) {
    try {
      await db.collection('customers').add({
        data: {
          name: c.name,
          alias: c.alias,
          shortName: c.alias,  // shortName 使用 alias
          contact: c.contact || '',
          phone: c.phone,
          region: c.region,
          description: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      successCount++
      if (successCount % 50 === 0) {
        console.log(`已导入 ${successCount} 个客户...`)
      }
    } catch (err) {
      console.error(`导入客户 ${c.name} 失败:`, err.message)
      failCount++
    }
  }
  
  console.log(`\n客户导入完成！成功：${successCount}, 失败：${failCount}`)
}

// 导入商品数据
async function importProducts() {
  console.log('\n开始导入商品数据...')
  
  // 读取原型数据
  const productsPath = path.join(__dirname, '../docs/ui/_DEFAULT_PRODUCTS_generated.txt')
  const productsContent = fs.readFileSync(productsPath, 'utf8')
  const DEFAULT_PRODUCTS = parseJsProducts(productsContent)
  
  if (!DEFAULT_PRODUCTS) {
    console.error('无法解析商品数据')
    return
  }
  
  console.log(`找到 ${DEFAULT_PRODUCTS.length} 个商品`)
  
  // 清空现有商品数据
  console.log('清空现有商品数据...')
  const existingProducts = await db.collection('products').get()
  if (existingProducts.data.length > 0) {
    console.log(`删除 ${existingProducts.data.length} 个现有商品`)
    for (const product of existingProducts.data) {
      await db.collection('products').doc(product._id).remove()
    }
  }
  
  // 导入新商品数据
  let successCount = 0
  let failCount = 0
  
  for (const p of DEFAULT_PRODUCTS) {
    try {
      // 根据计价模式确定单位：case=包，piece=件
      const unit = p.pricing_mode === 'case' ? '包' : (p.pricing_mode === 'piece' ? '件' : p.unit)
      
      await db.collection('products').add({
        data: {
          material_code: p.material_code,
          name: p.name,
          spec: p.spec,
          pricing_mode: p.pricing_mode,
          unit_piece_qty: p.unit_piece_qty,
          price_piece: p.price_piece,  // 件价（整箱/整件的价格）
          price_unit: (p.price_unit != null ? p.price_unit : p.price_zero),    // 包价（单包的价格）
          unit: unit,  // 统一为'件'或'包'
          pinyin: p.pinyin || '',
          is_adjustable: p.is_adjustable,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      successCount++
      if (successCount % 30 === 0) {
        console.log(`已导入 ${successCount} 个商品...`)
      }
    } catch (err) {
      console.error(`导入商品 ${p.name} 失败:`, err.message)
      failCount++
    }
  }
  
  console.log(`\n商品导入完成！成功：${successCount}, 失败：${failCount}`)
}

// 主函数
async function main() {
  try {
    await importCustomers()
    await importProducts()
    console.log('\n✅ 所有数据导入完成！')
    process.exit(0)
  } catch (err) {
    console.error('导入失败:', err)
    process.exit(1)
  }
}

main()
