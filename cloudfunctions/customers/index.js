const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function checkPermission(openid, permission) {
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
      return { code: 401, message: '用户不存在且创建失败' }
    }
  }
  const user = userResult.data[0]
  if (!user.permissions || !user.permissions.includes(permission)) {
    return { code: 403, message: '无权限访问' }
  }
  return { code: 0, user }
}

exports.main = async (event, context) => {
  const { action } = event
  const openid = cloud.getWXContext().OPENID

  switch (action) {
    case 'list': {
      const { searchKey } = event
      let query = db.collection('customers')
      if (searchKey) {
        query = query.where(db.command.or([
          { name: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { alias: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { phone: db.RegExp({ regexp: searchKey, options: 'i' }) },
          { region: db.RegExp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      const res = await query.orderBy('createdAt', 'desc').limit(100).get()
      
      return { code: 0, data: res.data }
    }
    case 'create': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      const { name, alias, shortName, short_name, region_code, phone, contact, region, description, aliases } = event
      
      // 兼容 shortName 和 short_name 字段
      const finalShortName = shortName || short_name || alias
      
      const newCustomer = {
        name,
        alias,
        shortName: finalShortName,
        short_name: finalShortName,
        region_code: region_code || '',
        phone: phone || '',
        contact: contact || '',
        region: region || '',
        description: description || '',
        aliases: aliases || [],
        createdBy: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      const res = await db.collection('customers').add({ data: newCustomer })
      
      return { code: 0, data: { _id: res._id } }
    }
    case 'update': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      const { customerId, name, alias, shortName, short_name, region_code, phone, contact, region, description, aliases } = event
      
      // 兼容 shortName 和 short_name 字段
      const finalShortName = shortName || short_name || event.alias
      
      // 更新客户信息
      const updateData = {
        name: name || event.name,
        alias: alias || event.alias,
        shortName: finalShortName,
        short_name: finalShortName,
        region_code: region_code !== undefined ? region_code : event.region_code || '',
        phone: phone || event.phone,
        contact: contact || event.contact,
        region: region || event.region || '',
        description: description !== undefined ? description : event.description || '',
        aliases: aliases !== undefined ? aliases : event.aliases || [],
        updatedAt: db.serverDate()
      }
      
      await db.collection('customers').doc(customerId).update({ 
        data: updateData
      })
      
      return { code: 0, data: {} }
    }
    case 'delete': {
      const authResult = await checkPermission(openid, 'customer:edit')
      if (authResult.code !== 0) return authResult

      // 删除客户
      await db.collection('customers').doc(event.customerId).remove()
      return { code: 0, data: {} }
    }
    case 'regions': {
      // 获取所有区域用于下拉选择
      const regionsResult = await db.collection('regions').get()
      return { code: 0, data: regionsResult.data }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
