/**
 * 调用云函数导入完整数据
 */

const cloud = require('@cloudbase/node-sdk')

cloud.init({
  env: process.env.TCB_ENV || 'test-env'
})

async function importCustomers() {
  console.log('正在导入客户数据...')
  try {
    const result = await cloud.callFunction({
      name: 'import-data',
      data: {
        action: 'import-customers'
      }
    })
    console.log('✅ 客户数据导入结果:', result.result)
    return result.result
  } catch (e) {
    console.error('❌ 客户数据导入失败:', e)
    throw e
  }
}

async function importProducts() {
  console.log('正在导入商品数据...')
  try {
    const result = await cloud.callFunction({
      name: 'import-data',
      data: {
        action: 'import-products'
      }
    })
    console.log('✅ 商品数据导入结果:', result.result)
    return result.result
  } catch (e) {
    console.error('❌ 商品数据导入失败:', e)
    throw e
  }
}

async function verifyData() {
  console.log('\n验证数据...')
  const db = cloud.database()
  
  const customersCount = await db.collection('customers').count()
  const productsCount = await db.collection('products').count()
  
  console.log(`客户总数：${customersCount.total}`)
  console.log(`商品总数：${productsCount.total}`)
  
  const customers = await db.collection('customers').limit(1).get()
  const products = await db.collection('products').limit(1).get()
  
  console.log('\n客户数据示例:')
  console.log(JSON.stringify(customers.data[0], null, 2))
  
  console.log('\n商品数据示例:')
  console.log(JSON.stringify(products.data[0], null, 2))
}

async function main() {
  try {
    await importCustomers()
    await importProducts()
    await verifyData()
    console.log('\n✅ 数据导入完成!')
  } catch (e) {
    console.error('\n❌ 导入失败:', e)
    process.exit(1)
  }
}

main()
