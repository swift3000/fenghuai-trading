// 清除所有测试数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// T55-SC-3（P0，graph二轮安全流）：原函数生产态无任何鉴权，任一小程序用户 callFunction
// 即可清空 customers/products/orders/receivable/outbound/members 六集合。
// 现补管理员门禁（口径与业务侧一致：role=admin 且 status 非禁用；OPENID 缺失=未登录拒绝）。
async function checkAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: 401, message: '未登录' }
  const res = await db.collection('users').where({ openid: OPENID }).limit(1).get()
  const user = res.data && res.data[0]
  if (!user || user.role !== 'admin') return { code: 403, message: '只有管理员可以访问' }
  if (user.status && user.status !== 'active') return { code: 403, message: '账号已被禁用' }
  return { code: 0 }
}

exports.main = async (event, context) => {
  // T55-SC-3：admin 门禁（纵深防御：前端零引用，此函数仅留作管理员应急清数据通道）
  const gate = await checkAdmin()
  if (gate.code !== 0) return gate

  try {
    // 清除所有业务数据集合
    // T58-R6（graph第6轮）：原清单错误——receivable/outbound/members 是云函数名非集合名（remove 会静默失败），
    // 且漏了真实的收款流水集合 payments（清库后残留孤儿收款，对账/赊销页脏数据）+ auto_confirm_log。
    // 只清业务数据，不动 users/system_config（身份与配置）。
    const collections = ['customers', 'products', 'orders', 'payments', 'auto_confirm_log']
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
