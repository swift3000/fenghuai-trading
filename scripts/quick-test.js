/**
 * 快速测试 - 在云开发控制台直接运行
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function quickTest() {
  console.log('开始快速测试...\n')
  
  try {
    // 1. 导入所有数据
    console.log('1. 导入所有数据...')
    const importResult = await cloud.callFunction({
      name: 'import-data',
      data: { action: 'import-all' }
    })
    console.log('导入结果:', importResult.result)
    console.log('')
    
    // 2. 验证数据
    console.log('2. 验证数据...')
    const [customers, products] = await Promise.all([
      db.collection('customers').count({ limit: 1 }),
      db.collection('products').count({ limit: 1 })
    ])
    console.log('客户总数:', customers.total)
    console.log('商品总数:', products.total)
    console.log('')
    
    // 3. 查看数据样例
    console.log('3. 查看数据样例...')
    const [sampleCustomer, sampleProduct] = await Promise.all([
      db.collection('customers').limit(1).get(),
      db.collection('products').limit(1).get()
    ])
    console.log('客户样例:', JSON.stringify(sampleCustomer.data[0], null, 2))
    console.log('商品样例:', JSON.stringify(sampleProduct.data[0], null, 2))
    console.log('')
    
    // 4. 测试订单创建
    console.log('4. 测试订单创建...')
    const [testCustomer, testProduct] = await Promise.all([
      db.collection('customers').limit(1).get(),
      db.collection('products').limit(1).get()
    ])
    
    if (testCustomer.data.length > 0 && testProduct.data.length > 0) {
      const orderData = {
        customer_id: testCustomer.data[0]._id,
        customer_name: testCustomer.data[0].name,
        items: [{
          material_code: testProduct.data[0].material_code,
          name: testProduct.data[0].name,
          quantity: 10,
          unit: '包',
          unit_price: testProduct.data[0].price_unit,
          amount: 10 * testProduct.data[0].price_unit
        }],
        total_amount: 10 * testProduct.data[0].price_unit,
        status: 'pending',
        create_time: new Date(),
        update_time: new Date()
      }
      
      const order = await db.collection('orders').add({ data: orderData })
      console.log('订单创建成功，ID:', order._id)
      
      // 删除测试订单
      await db.collection('orders').doc(order._id).remove()
      console.log('测试订单已删除')
    }
    
    console.log('\n✅ 所有测试通过！')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

quickTest()
