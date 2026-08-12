/**
 * 清空所有旧数据云函数
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function clearCollection(collectionName) {
  console.log(`开始清空 ${collectionName} 表...`)
  
  // 先统计数量
  const countResult = await db.collection(collectionName).count()
  const total = countResult.total
  
  if (total === 0) {
    console.log(`${collectionName} 表已经是空的`)
    return 0
  }
  
  console.log(`${collectionName} 表有 ${total} 条数据，开始删除...`)
  
  // 直接删除所有数据（不支持 limit，需要分批获取 ID 后删除）
  let deletedCount = 0
  const batchSize = 1000
  
  while (deletedCount < total) {
    const records = await db.collection(collectionName)
      .limit(batchSize)
      .get()
    
    if (records.data.length === 0) break
    
    // 批量删除这批记录的 ID
    const ids = records.data.map(r => r._id)
    const result = await db.collection(collectionName)
      .where({
        _id: db.command.in(ids)
      })
      .remove()
    
    deletedCount += result.statsDeleted || ids.length
    console.log(`${collectionName} 已删除 ${deletedCount}/${total} 条`)
  }
  
  console.log(`${collectionName} 表清空完成，共删除 ${deletedCount} 条`)
  return deletedCount
}

exports.main = async (event, context) => {
  console.log('开始清空所有旧数据...')
  
  try {
    // 依次清空，避免并发压力
    const customersDeleted = await clearCollection('customers')
    const productsDeleted = await clearCollection('products')
    const ordersDeleted = await clearCollection('orders')
    
    return {
      success: true,
      message: '所有旧数据清空完成',
      deleted: {
        customers: customersDeleted,
        products: productsDeleted,
        orders: ordersDeleted,
        total: customersDeleted + productsDeleted + ordersDeleted
      }
    }
  } catch (error) {
    console.error('清空数据失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}
