const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== QA 测试身份钩子（生产默认关闭，安全）=====
// 仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时，
// 用指定 openid 覆盖本次请求身份，用于自动化多角色权限测试。
// 生产环境不设置 QA_IMPERSONATE → 钩子惰性，完全不影响真实用户请求。
let __impersonatedOpenid = null

const _ = db.command

// 转义搜索词中的正则特殊字符，避免 db.RegExp/_.regexp 构造抛异常（用户输入含 ( [ * ? 等会 500）
function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
  const wxContext = cloud.getWXContext()
  const openid = __impersonatedOpenid || wxContext.OPENID
  const { action } = event

  // 权限校验
  async function checkPermission(permission) {
//     安全加固：无身份(空openid)一律拒绝——原"后台调用放行admin"为越权漏洞；内部定时 action 不走权限映射，不受影响
  if (!openid) { return { code: 401, message: '无法获取用户身份，请在小程序内访问' } }
    
    const userResult = await db.collection('users').where({ openid }).get()
    if (userResult.data.length === 0) {
      // 未注册用户不自动提权：管理员创建统一走 auth.login 的「零配置首管理员」逻辑
      return { code: 401, message: '用户不存在，请先登录' }
    }
    const user = userResult.data[0]
    if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }

    if (user.role === 'admin') return { code: 0, user }
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
        // T62-V1：wx-server-sdk 的 db.command 无 .regexp 方法（应 db.RegExp），原 _.regexp 恒 500；对齐 customers 口径
        query = query.where(db.command.or([
          { name: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { material_code: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) },
          { pinyin: db.RegExp({ regexp: escapeRegExp(searchKey), options: 'i' }) }
        ]))
      }
      
      const res = await query.orderBy('createdAt', 'desc').limit(1000).get()
      
      // 字段映射，兼容前端旧字段名
      const products = res.data.map(p => ({
        _id: p._id,
        name: p.name,
        material_code: p.material_code,
        spec: p.spec,
        pricing_mode: p.pricing_mode,
        unit_piece_qty: p.unit_piece_qty,
        price_piece: p.price_piece,
        price_unit: (p.price_unit != null ? p.price_unit : p.price_zero),
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

      const { name, material_code, spec, pricing_mode, unit_piece_qty, price_piece, price_unit, unit, pinyin, is_adjustable } = event
      if (!name || !String(name).trim()) return { code: 4001, message: '商品名称不能为空' }
      
      const newProduct = {
        name,
        material_code: material_code !== undefined ? material_code : '',
        spec: spec !== undefined ? spec : '',
        pricing_mode: pricing_mode || 'case',
        unit_piece_qty: unit_piece_qty !== undefined ? unit_piece_qty : 1,
        price_piece: price_piece !== undefined ? price_piece : null,
        price_unit: price_unit !== undefined ? price_unit : null,
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

      const { productId, name, material_code, spec, pricing_mode, unit_piece_qty, price_piece, price_unit, unit, pinyin, is_adjustable } = event
      
      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (material_code !== undefined) updateData.material_code = material_code
      if (spec !== undefined) updateData.spec = spec
      if (pricing_mode !== undefined) updateData.pricing_mode = pricing_mode
      if (unit_piece_qty !== undefined) updateData.unit_piece_qty = unit_piece_qty
      if (price_piece !== undefined) updateData.price_piece = price_piece
      if (price_unit !== undefined) updateData.price_unit = price_unit
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

      // T62-A2：.doc().get() 对不存在 ID 抛底层异常（document ... does not exist），非统一信封
      let product = null
      try {
        const productResult = await db.collection('products').doc(event.productId).get()
        product = productResult.data
      } catch (e) {
        return { code: 4004, message: '商品不存在' }
      }
      return { code: 0, data: product }
    }

    default:
      return { code: 1001, message: '未知 action' }
  }
}
