/**
 * 导入数据到云数据库
 * 在微信开发者工具中运行
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function importAllData() {
  console.log('=== 开始导入数据 ===\n')
  
  try {
    // 1. 导入客户数据
    console.log('1. 导入客户数据...')
    const customerResult = await cloud.callFunction({
      name: 'import-data',
      data: { action: 'import-customers' }
    })
    console.log('客户导入结果:', customerResult.result)
    console.log('')
    
    // 2. 导入商品数据
    console.log('2. 导入商品数据...')
    const productResult = await cloud.callFunction({
      name: 'import-data',
      data: { action: 'import-products' }
    })
    console.log('商品导入结果:', productResult.result)
    console.log('')
    
    // 3. 验证数据
    console.log('3. 验证数据...')
    const [customers, products] = await Promise.all([
      db.collection('customers').count({ limit: 1 }),
      db.collection('products').count({ limit: 1 })
    ])
    
    console.log('客户总数:', customers.total)
    console.log('商品总数:', products.total)
    console.log('')
    
    // 4. 查看示例数据
    console.log('4. 查看示例数据...')
    const [sampleCustomers, sampleProducts] = await Promise.all([
      db.collection('customers').limit(2).get(),
      db.collection('products').limit(3).get()
    ])
    
    console.log('客户示例:', JSON.stringify(sampleCustomers.data, null, 2))
    console.log('商品示例:', JSON.stringify(sampleProducts.data, null, 2))
    
    console.log('\n=== 导入完成 ===')
    
  } catch (error) {
    console.error('导入失败:', error)
  }
}

importAllData()
