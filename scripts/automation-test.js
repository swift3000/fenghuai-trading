/**
 * 完整自动化测试脚本
 * 在微信开发者工具云开发控制台的「云函数」->「import-data」->「测试」中运行
 * 或者在小程序的 Console 中运行
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function runFullTest() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   丰淮商贸 - 完整自动化测试开始        ║')
  console.log('╚════════════════════════════════════════╝\n')
  
  let totalTests = 0
  let passedTests = 0
  
  // 测试 1：导入客户数据
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】导入客户数据...`)
    const result = await cloud.callFunction({
      name: 'import-data',
      data: { action: 'import-customers' }
    })
    
    if (result.result.success && result.result.successCount === 282) {
      console.log(`✅ 通过：成功导入 ${result.result.successCount} 个客户\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：${result.result.message}\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 2：导入商品数据
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】导入商品数据...`)
    const result = await cloud.callFunction({
      name: 'import-data',
      data: { action: 'import-products' }
    })
    
    if (result.result.success && result.result.successCount === 180) {
      console.log(`✅ 通过：成功导入 ${result.result.successCount} 个商品\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：${result.result.message}\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 3：验证客户数据结构
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】验证客户数据结构...`)
    const customer = await db.collection('customers').limit(1).get()
    const data = customer.data[0]
    
    const requiredFields = ['name', 'alias', 'region', 'phone', 'contact', 'shortName', 'description']
    const hasAllFields = requiredFields.every(field => field in data)
    
    if (hasAllFields) {
      console.log(`✅ 通过：客户数据结构正确，包含所有必需字段\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：客户数据结构不完整\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 4：验证商品数据结构
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】验证商品数据结构...`)
    const product = await db.collection('products').limit(1).get()
    const data = product.data[0]
    
    const requiredFields = ['material_code', 'name', 'spec', 'pricing_mode', 'unit_piece_qty', 'price_piece', 'price_unit', 'unit']
    const hasAllFields = requiredFields.every(field => field in data)
    
    if (hasAllFields) {
      console.log(`✅ 通过：商品数据结构正确，包含所有必需字段\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：商品数据结构不完整\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 5：验证商品双价格模型
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】验证商品双价格模型...`)
    const products = await db.collection('products').where({
      pricing_mode: 'case'
    }).limit(5).get()
    
    const hasCorrectPricing = products.data.every(p => 
      p.price_piece !== null && p.price_unit !== null
    )
    
    if (hasCorrectPricing) {
      console.log(`✅ 通过：商品双价格模型正确\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：商品双价格模型不正确\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 6：查询商品列表
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】查询商品列表...`)
    const products = await db.collection('products').limit(10).get()
    
    if (products.data.length === 10) {
      console.log(`✅ 通过：成功查询 ${products.data.length} 个商品\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：查询商品数量不正确\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 7：查询客户列表
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】查询客户列表...`)
    const customers = await db.collection('customers').limit(10).get()
    
    if (customers.data.length === 10) {
      console.log(`✅ 通过：成功查询 ${customers.data.length} 个客户\n`)
      passedTests++
    } else {
      console.log(`❌ 失败：查询客户数量不正确\n`)
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 测试 8：测试订单创建
  totalTests++
  try {
    console.log(`【测试 ${totalTests}】测试订单创建...`)
    
    // 获取一个商品和一个客户
    const [product, customer] = await Promise.all([
      db.collection('products').limit(1).get(),
      db.collection('customers').limit(1).get()
    ])
    
    if (product.data.length === 0 || customer.data.length === 0) {
      console.log(`⚠️  跳过：数据不足\n`)
    } else {
      const orderData = {
        customer_id: customer.data[0]._id,
        customer_name: customer.data[0].name,
        items: [{
          material_code: product.data[0].material_code,
          name: product.data[0].name,
          quantity: 10,
          unit: '包',
          unit_price: product.data[0].price_unit,
          amount: 10 * product.data[0].price_unit
        }],
        total_amount: 10 * product.data[0].price_unit,
        status: 'pending',
        create_time: new Date(),
        update_time: new Date()
      }
      
      const order = await db.collection('orders').add({ data: orderData })
      
      if (order._id) {
        // 删除测试订单
        await db.collection('orders').doc(order._id).remove()
        console.log(`✅ 通过：订单创建成功\n`)
        passedTests++
      } else {
        console.log(`❌ 失败：订单创建失败\n`)
      }
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}\n`)
  }
  
  // 汇总结果
  console.log('╔════════════════════════════════════════╗')
  console.log(`║   测试完成：${passedTests}/${totalTests} 通过              ║`)
  console.log('╚════════════════════════════════════════╝')
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！系统运行正常')
  } else {
    console.log(`\n⚠️  有 ${totalTests - passedTests} 个测试失败，请检查问题`)
  }
}

runFullTest()
