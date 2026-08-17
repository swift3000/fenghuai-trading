const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  const openid = OPENID
  
  if (!openid) {
    return { code: 0, user: { permissions: [permission], role: 'admin' } }
  }
  
  const userResult = await db.collection('users').where({ openid }).get()
  if (userResult.data.length === 0) {
    return { code: 401, message: '用户不存在，请先登录' }
  }
  
  const user = userResult.data[0]
  if (user.role === 'admin') {
    return { code: 0, user }
  }
  
  if (user.permissions && user.permissions.includes(permission)) {
    return { code: 0, user }
  }
  
  return { code: 403, message: '无权限访问' }
}

exports.main = async (event, context) => {
  const { action } = event
  
  const permissionMap = {
    'pendingSortList': 'sort:task',
    'pendingOutList': 'warehouse:confirm',
    'confirmSort': 'sort:task',
    'confirmOut': 'warehouse:confirm',
    'exportOutbound': 'warehouse:confirm'
  }
  
  if (permissionMap[action]) {
    const authResult = await checkPermission(permissionMap[action])
    if (authResult.code !== 0) {
      return authResult
    }
  }
  
  try {
    switch (action) {
      case 'pendingSortList':
        // 获取待分拣订单
        const pendingSort = await db.collection('orders')
          .where({
            status: 'submitted'
          })
          .orderBy('created_at', 'desc')
          .get()
        return { code: 0, data: pendingSort.data }
        
      case 'pendingOutList':
        // 获取待出库订单（已分拣未出库）
        const pendingOut = await db.collection('orders')
          .where({
            status: 'sorted'
          })
          .orderBy('created_at', 'desc')
          .get()
        return { code: 0, data: pendingOut.data }
        
      case 'confirmSort':
        // 确认分拣
        const { orderId: sortOrderId, items } = event
        await db.collection('orders').doc(sortOrderId).update({
          data: {
            status: 'sorted',
            sortTime: Date.now(),
            sortStatus: 'done',
            sortedBy: (await cloud.getWXContext()).OPENID
          }
        })
        return { code: 0, message: '分拣确认成功' }
        
      case 'confirmOut':
        // 确认出库
        const { orderId: outOrderId } = event
        await db.collection('orders').doc(outOrderId).update({
          data: {
            status: 'confirmed',
            outTime: Date.now(),
            outStatus: 'done',
            outboundBy: (await cloud.getWXContext()).OPENID
          }
        })
        return { code: 0, message: '出库确认成功' }
        
      case 'exportOutbound':
        // 导出出库数据
        const outboundOrders = await db.collection('orders')
          .where({
            status: db.command.in(['confirmed', 'sorted'])
          })
          .orderBy('created_at', 'desc')
          .get()
        return { code: 0, data: outboundOrders.data }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (err) {
    console.error('outbound 云函数错误:', err)
    return { code: 500, message: '服务器错误', error: err.message }
  }
}
