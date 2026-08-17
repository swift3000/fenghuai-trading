// 清除所有测试数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 清除所有集合数据
    const collections = ['customers', 'products', 'orders', 'receivable', 'outbound', 'members']
    const results = []
    
    for (const col of collections) {
      try {
        await db.collection(col).remove({ multiple: true })
        results.push({ collection: col, status: 'cleared' })
      } catch (e) {
        results.push({ collection: col, status: 'error', error: e.message })
      }
    }
    
    return {
      success: true,
      message: '清除完成',
      results
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}
