const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // 权限校验
  async function checkPermission(permission) {
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

  switch (action) {
    case 'list': {
      // 所有用户都可以查看商品
      const authResult = await checkPermission('product:view')
      if (authResult.code !== 0) return authResult

      const { searchKey } = event
      let query = db.collection('products')
      
      if (searchKey) {
        query = query.where(_.or([
          { name: _.regexp({ regexp: searchKey, options: 'i' }) },
          { material_code: _.regexp({ regexp: searchKey, options: 'i' }) },
          { pinyin: _.regexp({ regexp: searchKey, options: 'i' }) }
        ]))
      }
      
      const res = await query.orderBy('createdAt', 'desc').limit(100).get()
      
      // 字段映射，兼容前端旧字段名
      const products = res.data.map(p => ({
        _id: p._id,
        name: p.name,
        material_code: p.material_code,
        spec: p.spec,
        pricing_mode: p.pricing_mode,
        unit_piece_qty: p.unit_piece_qty,
        price_piece: p.price_piece,
        price_zero: p.price_zero,
        unit: p.unit,
        pinyin: p.pinyin,
        is_adjustable: p.is_adjustable
      }))
      
      return { code: 0, data: products }
    }

    case 'create': {
      // 只有管理员可以创建商品
      const authResult = await checkPermission('product:edit')
      if (authResult.code !== 0) return authResult

      const { name, material_code, spec, pricing_mode, unit_piece_qty, price_piece, price_zero, unit, pinyin, is_adjustable } = event
      
      const newProduct = {
        name,
        material_code: material_code !== undefined ? material_code : '',
        spec: spec !== undefined ? spec : '',
        pricing_mode: pricing_mode || 'case',
        unit_piece_qty: unit_piece_qty !== undefined ? unit_piece_qty : 1,
        price_piece: price_piece !== undefined ? price_piece : null,
        price_zero: price_zero !== undefined ? price_zero : null,
        unit: unit || '包',
        pinyin: pinyin !== undefined ? pinyin : '',
        is_adjustable: is_adjustable !== undefined ? is_adjustable : false,
        createdBy: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      const res = await db.collection('products').add({ data: newProduct })
      
      return { code: 0, data: { _id: res._id } }
    }

    case 'update': {
      // 只有管理员可以更新商品
      const authResult = await checkPermission('product:edit')
      if (authResult.code !== 0) return authResult

      const { productId, name, material_code, spec, pricing_mode, unit_piece_qty, price_piece, price_zero, unit, pinyin, is_adjustable } = event
      
      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (material_code !== undefined) updateData.material_code = material_code
      if (spec !== undefined) updateData.spec = spec
      if (pricing_mode !== undefined) updateData.pricing_mode = pricing_mode
      if (unit_piece_qty !== undefined) updateData.unit_piece_qty = unit_piece_qty
      if (price_piece !== undefined) updateData.price_piece = price_piece
      if (price_zero !== undefined) updateData.price_zero = price_zero
      if (unit !== undefined) updateData.unit = unit
      if (pinyin !== undefined) updateData.pinyin = pinyin
      if (is_adjustable !== undefined) updateData.is_adjustable = is_adjustable
      updateData.updatedAt = db.serverDate()

      await db.collection('products').doc(productId).update({ data: updateData })

      return { code: 0, data: {} }
    }

    case 'delete': {
      // 只有管理员可以删除商品
      const authResult = await checkPermission('product:edit')
      if (authResult.code !== 0) return authResult

      await db.collection('products').doc(event.productId).remove()
      
      return { code: 0, data: {} }
    }

    case 'getDetail': {
      // 所有用户都可以查看商品详情
      const authResult = await checkPermission('product:view')
      if (authResult.code !== 0) return authResult

      const productResult = await db.collection('products').doc(event.productId).get()
      
      const product = productResult.data
      
      return { code: 0, data: product }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
