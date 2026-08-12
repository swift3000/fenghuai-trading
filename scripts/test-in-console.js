/**
 * 数据导入测试 - 在微信开发者工具 Console 中运行
 * 复制整个代码到 Console 中执行
 */

// 初始化云开发
wx.cloud.init({
  env: 'cloud1-d6g75loi673b1e039',
  traceUser: true
})

console.log('╔════════════════════════════════════════╗')
console.log('║   丰淮商贸 - 数据导入测试              ║')
console.log('╚════════════════════════════════════════╝\n')

async function testImport() {
  try {
    console.log('开始导入数据...\n')
    
    // 调用导入云函数
    const result = await wx.cloud.callFunction({
      name: 'import-data',
      data: {
        action: 'import-all'
      }
    })
    
    console.log('导入结果:')
    console.log(JSON.stringify(result.result, null, 2))
    console.log('\n')
    
    // 验证数据
    console.log('验证数据...')
    const db = wx.cloud.database()
    const [customers, products] = await Promise.all([
      db.collection('customers').count({ limit: 1 }),
      db.collection('products').count({ limit: 1 })
    ])
    
    console.log('客户总数:', customers.total)
    console.log('商品总数:', products.total)
    console.log('\n')
    
    // 查看样例
    console.log('查看样例数据...')
    const [sampleCustomer, sampleProduct] = await Promise.all([
      db.collection('customers').limit(1).get(),
      db.collection('products').limit(1).get()
    ])
    
    console.log('客户样例:', JSON.stringify(sampleCustomer.data[0], null, 2))
    console.log('商品样例:', JSON.stringify(sampleProduct.data[0], null, 2))
    
    console.log('\n✅ 导入完成！')
    
  } catch (error) {
    console.error('❌ 导入失败:', error)
  }
}

testImport()
