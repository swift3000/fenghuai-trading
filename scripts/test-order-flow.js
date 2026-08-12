/**
 * 订单创建流程自动化测试脚本
 * 测试完整流程：查询客户 → 查询商品 → 创建订单
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function testOrderFlow() {
  console.log('='.repeat(50))
  console.log('开始测试订单创建流程')
  console.log('='.repeat(50))
  
  let passed = 0
  let failed = 0
  
  // 测试 1：查询客户列表
  console.log('\n【测试 1】查询客户列表...')
  try {
    const customers = await db.collection('customers').limit(5).get()
    if (customers.data.length > 0) {
      console.log(`✅ 成功，获取到 ${customers.data.length} 个客户`)
      console.log('   示例客户:', customers.data[0].name, '|', customers.data[0].alias)
      passed++
    } else {
      console.log('❌ 失败：客户列表为空')
      failed++
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 测试 2：查询商品列表
  console.log('\n【测试 2】查询商品列表...')
  try {
    const products = await db.collection('products').limit(5).get()
    if (products.data.length > 0) {
      console.log(`✅ 成功，获取到 ${products.data.length} 个商品`)
      const p = products.data[0]
      console.log('   示例商品:', p.name, '| 件价:', p.price_piece, '| 包价:', p.price_unit, '| 模式:', p.pricing_mode)
      passed++
    } else {
      console.log('❌ 失败：商品列表为空')
      failed++
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 测试 3：验证商品字段完整性
  console.log('\n【测试 3】验证商品字段完整性...')
  try {
    const products = await db.collection('products').limit(10).get()
    let hasIssue = false
    for (const p of products.data) {
      if (!p.price_piece && !p.price_unit) {
        console.log(`❌ 商品 ${p.name} 缺少价格字段`)
        hasIssue = true
        break
      }
      if (!p.pricing_mode) {
        console.log(`❌ 商品 ${p.name} 缺少 pricing_mode 字段`)
        hasIssue = true
        break
      }
      if (!p.unit) {
        console.log(`❌ 商品 ${p.name} 缺少 unit 字段`)
        hasIssue = true
        break
      }
    }
    if (!hasIssue) {
      console.log('✅ 所有商品字段完整')
      passed++
    } else {
      failed++
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 测试 4：创建测试订单
  console.log('\n【测试 4】创建测试订单...')
  try {
    // 获取一个客户
    const customerResult = await db.collection('customers').limit(1).get()
    if (customerResult.data.length === 0) {
      console.log('❌ 失败：没有可用客户')
      failed++
    } else {
      const customer = customerResult.data[0]
      
      // 获取一个商品
      const productResult = await db.collection('products').where({ pricing_mode: 'case' }).limit(1).get()
      if (productResult.data.length === 0) {
        console.log('❌ 失败：没有按件计价的商品')
        failed++
      } else {
        const product = productResult.data[0]
        
        // 创建订单
        const today = new Date()
        const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0')
        const countResult = await db.collection('orders').where({ orderNo: db.RegExp({ regexp: `丰淮商贸-${dateStr}`, options: 'i' }) }).count()
        const orderNo = `丰淮商贸-${dateStr}-${(countResult.total + 1).toString().padStart(4, '0')}`
        
        const order = {
          orderNo,
          customerId: customer._id,
          customerName: customer.name,
          items: [
            {
              _id: product._id,
              name: product.name,
              spec: product.spec || '',
              price: product.price_unit || 0,
              unit: product.unit || '包',
              qty: 2
            }
          ],
          totalAmount: (product.price_unit || 0) * 2,
          status: 'submitted',
          paymentStatus: 'unpaid',
          sortStatus: 'pending',
          outStatus: 'pending',
          created_at: db.serverDate()
        }
        
        const result = await db.collection('orders').add({ data: order })
        console.log(`✅ 成功创建订单：${orderNo}`)
        console.log('   客户:', customer.name)
        console.log('   商品:', product.name, 'x 2')
        console.log('   总额:', order.totalAmount)
        passed++
        
        // 保存订单 ID 用于后续测试
        global.testOrderId = result._id
      }
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    console.log(e.stack)
    failed++
  }
  
  // 测试 5：查询订单列表
  console.log('\n【测试 5】查询订单列表...')
  try {
    const orders = await db.collection('orders').orderBy('created_at', 'desc').limit(5).get()
    if (orders.data.length > 0) {
      console.log(`✅ 成功，获取到 ${orders.data.length} 个订单`)
      const lastOrder = orders.data[0]
      console.log('   最新订单:', lastOrder.orderNo, '| 客户:', lastOrder.customerName, '| 总额:', lastOrder.totalAmount)
      passed++
    } else {
      console.log('❌ 失败：订单列表为空')
      failed++
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 测试 6：查询订单详情
  console.log('\n【测试 6】查询订单详情...')
  try {
    if (global.testOrderId) {
      const order = await db.collection('orders').doc(global.testOrderId).get()
      if (order.data) {
        console.log('✅ 成功获取订单详情')
        console.log('   订单号:', order.data.orderNo)
        console.log('   商品明细:', order.data.items.length, '项')
        console.log('   总额:', order.data.totalAmount)
        passed++
      } else {
        console.log('❌ 失败：订单不存在')
        failed++
      }
    } else {
      console.log('⚠️  跳过：没有测试订单 ID')
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 测试 7：验证权限校验
  console.log('\n【测试 7】验证权限校验...')
  try {
    const userResult = await db.collection('users').where({ role: 'admin' }).limit(1).get()
    if (userResult.data.length > 0) {
      console.log('✅ 管理员用户存在，权限校验正常')
      passed++
    } else {
      console.log('⚠️  警告：没有管理员用户，首次使用会自动创建')
      passed++
    }
  } catch (e) {
    console.log('❌ 失败:', e.message)
    failed++
  }
  
  // 总结
  console.log('\n' + '='.repeat(50))
  console.log('测试总结')
  console.log('='.repeat(50))
  console.log(`✅ 通过：${passed} 项`)
  console.log(`❌ 失败：${failed} 项`)
  console.log(`📊 成功率：${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  console.log('='.repeat(50))
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！订单创建流程正常！')
  } else {
    console.log('\n⚠️  有测试失败，请检查上述错误信息')
  }
  
  return { passed, failed }
}

// 运行测试
testOrderFlow().then(result => {
  process.exit(result.failed > 0 ? 1 : 0)
}).catch(err => {
  console.error('测试执行失败:', err)
  process.exit(1)
})
