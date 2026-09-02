/**
 * 简化版数据导入 - 避免复杂依赖
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 简化测试数据
const TEST_CUSTOMERS = [
  { name: '万友超市', alias: '万友', region: '汉阴', phone: '13900000001', contact: '张经理', status: 'active', createdAt: new Date() },
  { name: '测试客户 0088', alias: '0088', region: '汉阴', phone: '13900000002', contact: '李经理', status: 'active', createdAt: new Date() },
  { name: '测试客户 1066', alias: '1066', region: '汉阴', phone: '13900000003', contact: '王经理', status: 'active', createdAt: new Date() }
]

const TEST_PRODUCTS = [
  { name: '金龙鱼食用油 5L', code: 'P001', unit: '瓶', price: 89.00, category: '粮油', status: 'active', createdAt: new Date() },
  { name: '五常大米 5kg', code: 'P002', unit: '袋', price: 68.00, category: '粮油', status: 'active', createdAt: new Date() },
  { name: '蒙牛纯牛奶 250ml*24', code: 'P003', unit: '箱', price: 58.00, category: '乳品', status: 'active', createdAt: new Date() }
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // T59-R7C-1（P2）：OPENID 脱敏对齐 auth 口径（防 PII 进云函数日志）
  console.log('🚀 开始导入测试数据，OPENID:', String(OPENID || '').slice(0, 6) + '***')
  
  try {
    // 导入客户
    console.log('📦 导入客户数据...')
    for (const customer of TEST_CUSTOMERS) {
      try {
        await db.collection('customers').add({ data: customer })
        console.log('✅ 添加客户:', customer.name)
      } catch (err) {
        console.error('❌ 添加客户失败:', customer.name, err.message)
      }
    }
    
    // 导入商品
    console.log('📦 导入商品数据...')
    for (const product of TEST_PRODUCTS) {
      try {
        await db.collection('products').add({ data: product })
        console.log('✅ 添加商品:', product.name)
      } catch (err) {
        console.error('❌ 添加商品失败:', product.name, err.message)
      }
    }
    
    return {
      code: 0,
      message: '测试数据导入成功',
      customers: TEST_CUSTOMERS.length,
      products: TEST_PRODUCTS.length
    }
  } catch (err) {
    console.error('❌ 导入数据失败:', err)
    return {
      code: 500,
      message: '导入失败：' + err.message
    }
  }
}
