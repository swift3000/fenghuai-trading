const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function clearAllData() {
  console.log('开始清空数据库...')
  
  try {
    // 清空客户表
    let customersDeleted = 0
    while (true) {
      const customers = await db.collection('customers').limit(1000).get()
      if (customers.data.length === 0) break
      
      for (const c of customers.data) {
        await db.collection('customers').doc(c._id).remove()
        customersDeleted++
      }
      console.log(`已删除 ${customersDeleted} 个客户`)
    }
    console.log(`客户表清空完成，共删除 ${customersDeleted} 条`)
    
    // 清空商品表
    let productsDeleted = 0
    while (true) {
      const products = await db.collection('products').limit(1000).get()
      if (products.data.length === 0) break
      
      for (const p of products.data) {
        await db.collection('products').doc(p._id).remove()
        productsDeleted++
      }
      console.log(`已删除 ${productsDeleted} 个商品`)
    }
    console.log(`商品表清空完成，共删除 ${productsDeleted} 条`)
    
    // 清空订单表
    let ordersDeleted = 0
    while (true) {
      const orders = await db.collection('orders').limit(1000).get()
      if (orders.data.length === 0) break
      
      for (const o of orders.data) {
        await db.collection('orders').doc(o._id).remove()
        ordersDeleted++
      }
      console.log(`已删除 ${ordersDeleted} 个订单`)
    }
    console.log(`订单表清空完成，共删除 ${ordersDeleted} 条`)
    
    return {
      success: true,
      message: '数据库清空完成',
      customers: customersDeleted,
      products: productsDeleted,
      orders: ordersDeleted
    }
  } catch (error) {
    console.error('清空数据失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

exports.main = async (event, context) => {
  return await clearAllData()
}
