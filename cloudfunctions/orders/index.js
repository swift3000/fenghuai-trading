const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  const openid = OPENID
  
  // 如果是后台调用（OPENID 为空），跳过权限校验
  if (!openid) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0, user: { permissions: [permission], role: 'admin' } }
  }
  
  const userResult = await db.collection('users').where({ openid }).get()
  if (userResult.data.length === 0) {
    // 如果没有用户数据，自动创建管理员
    try {
      await db.collection('users').add({
        data: {
          openid,
          name: '管理员',
          role: 'admin',
          phone: '',
          permissions: ['product:view', 'product:edit', 'customer:view', 'customer:edit', 'order:create', 'order:edit', 'order:delete', 'order:print', 'order:export', 'sort:task', 'warehouse:confirm', 'receivable:view', 'receivable:collect', 'receivable:confirm', 'receivable:discount', 'report:view', 'report:export', 'report:ledger', 'member:manage'],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, user: { permissions: [permission] } }
    } catch (e) {
      console.error('创建管理员失败:', e)
      return { code: 401, message: '用户不存在且创建失败' }
    }
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
  
  // 权限映射
  const permissionMap = {
    'create': 'order:create',
    'list': 'order:view',
    'detail': 'order:view',
    'update-status': 'order:edit',
    'delete': 'order:delete',
    'todayStats': 'report:view',
    'outboundList': 'warehouse:confirm',
    'confirmSort': 'sort:task',
    'confirmOut': 'warehouse:confirm',
  }
  
  // 如果 action 不在权限映射中，跳过权限校验
  if (!permissionMap[action]) {
    console.log(`⚠️ action "${action}" 无权限映射，跳过权限校验`)
  } else {
    const permission = permissionMap[action]
    const authResult = await checkPermission(permission)
    if (authResult.code !== 0) {
      return authResult
    }
  }
  
  switch (action) {
    case 'create': {
      const { customerId, customerName, items, totalAmount } = event
      if (totalAmount <= 0) return { code: 2001, message: '订单金额不能为 0' }
      const today = new Date()
      const dateStr = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2,'0') + today.getDate().toString().padStart(2,'0')
      const count = await db.collection('orders').where({ orderNo: db.RegExp({ regexp: `丰淮商贸-${dateStr}`, options: 'i' }) }).count()
      const orderNo = `丰淮商贸-${dateStr}-${(count.total + 1).toString().padStart(4, '0')}`
      const order = {
        orderNo, customerId, customerName, items,
        totalAmount, status: 'submitted',
        payment_status: 'unpaid', paymentStatus: 'unpaid',
        received_amount: 0, receivedAmount: 0,
        sortStatus: 'pending', outStatus: 'pending',
        created_at: db.serverDate()
      }
      const res = await db.collection('orders').add({ data: order })
      return { code: 0, data: { _id: res._id, orderNo } }
    }
    case 'list': {
      const { timeTab, searchKey } = event
      let query = db.collection('orders')
      if (searchKey) {
        query = query.where(db.command.or([
          { orderNo: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { customerName: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      if (timeTab === 'today') {
        const today = new Date(); today.setHours(0,0,0,0)
        query = query.where({ created_at: db.command.gte(today) })
      }
      const res = await query.orderBy('created_at', 'desc').limit(50).get()
      return { code: 0, data: res.data }
    }
    case 'detail': {
      const res = await db.collection('orders').doc(event.orderId).get()
      return { code: 0, data: res.data }
    }
    case 'update-status': {
      await db.collection('orders').doc(event.orderId).update({ data: { status: event.status } })
      return { code: 0, data: {} }
    }
    case 'delete': {
      await db.collection('orders').doc(event.orderId).remove()
      return { code: 0, data: {} }
    }
    case 'todayStats': {
      const today = new Date(); today.setHours(0,0,0,0)
      const res = await db.collection('orders').where({ created_at: db.command.gte(today) }).get()
      let amount = 0
      res.data.forEach(o => { amount += o.totalAmount || 0 })
      return { code: 0, data: { count: res.data.length, amount } }
    }
    case 'outboundList': {
      const { subTab } = event
      let query = db.collection('orders')
      
      if (subTab === 'sort') {
        query = query.where({ sortStatus: 'pending' })
      } else if (subTab === 'out') {
        query = query.where({ 
          sortStatus: 'done',
          outStatus: 'pending'
        })
      }
      
      const res = await query.orderBy('created_at', 'desc').limit(100).get()
      return { code: 0, data: res.data }
    }
    case 'confirmSort': {
      const { orderId, batchMode } = event
      
      if (batchMode) {
        await db.collection('orders').where({ sortStatus: 'pending' }).update({
          data: { 
            sortStatus: 'done',
            sortTime: db.serverDate()
          }
        })
      } else {
        await db.collection('orders').doc(orderId).update({
          data: { 
            sortStatus: 'done',
            sortTime: db.serverDate()
          }
        })
      }
      
      return { code: 0, data: {} }
    }
    case 'confirmOut': {
      const { orderId, batchMode } = event
      
      if (batchMode) {
        await db.collection('orders').where({ 
          sortStatus: 'done',
          outStatus: 'pending'
        }).update({
          data: { 
            outStatus: 'done',
            outTime: db.serverDate()
          }
        })
      } else {
        await db.collection('orders').doc(orderId).update({
          data: { 
            outStatus: 'done',
            outTime: db.serverDate()
          }
        })
      }
      
      return { code: 0, data: {} }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
