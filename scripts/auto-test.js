/**
 * 自动化测试脚本
 * 在微信开发者工具云开发控制台的「云函数」->「import-data」->「测试」中运行
 */

// 调用导入所有数据
wx.cloud.callFunction({
  name: 'import-data',
  data: {
    action: 'import-all'
  },
  success: res => {
    console.log('导入成功:', res)
    
    // 验证数据
    Promise.all([
      wx.cloud.database().collection('customers').count({ limit: 1 }),
      wx.cloud.database().collection('products').count({ limit: 1 })
    ]).then(([customers, products]) => {
      console.log('验证结果：')
      console.log('客户总数:', customers.data[0].total)
      console.log('商品总数:', products.data[0].total)
      
      // 测试获取商品
      wx.cloud.database().collection('products').limit(3).get().then(res => {
        console.log('商品示例:', res.data)
      })
      
      // 测试获取客户
      wx.cloud.database().collection('customers').limit(3).get().then(res => {
        console.log('客户示例:', res.data)
      })
    })
  },
  fail: err => {
    console.error('导入失败:', err)
  }
})
