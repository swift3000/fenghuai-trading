/**
 * 测试数据导入
 * 在微信开发者工具中运行
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-d6g75loi673b1e039'  // 替换为你的云环境 ID
})

const db = cloud.database()

async function testImport() {
  console.log('=== 开始测试数据导入 ===\n')
  
  try {
    // 测试导入客户数据
    console.log('1. 测试导入客户数据...')
    const customerResult = await cloud.callFunction({
      name: 'import-data',
      data: {
        action: 'import-customers'
      }
    })
    console.log('客户导入结果:', JSON.stringify(customerResult.result, null, 2))
    console.log('\n')
    
    // 测试导入商品数据
    console.log('2. 测试导入商品数据...')
    const productResult = await cloud.callFunction({
      name: 'import-data',
      data: {
        action: 'import-products'
      }
    })
    console.log('商品导入结果:', JSON.stringify(productResult.result, null, 2))
    console.log('\n')
    
    // 验证数据
    console.log('3. 验证数据...')
    const customers = await db.collection('customers').count({
      limit: 1
    })
    console.log('客户总数:', customers.total)
    
    const products = await db.collection('products').count({
      limit: 1
    })
    console.log('商品总数:', products.total)
    
    console.log('\n=== 测试完成 ===')
    
  } catch (error) {
    console.error('测试失败:', error)
  }
}

testImport()
