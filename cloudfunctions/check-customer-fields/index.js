const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// T55-SC-4（P2，graph二轮安全流）：本函数原生产态无鉴权，可读取 5 条客户样本（字段结构探测工具）。
// 补管理员门禁（口径同 clear-all-data / init-db）。
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
  const gate = await checkAdmin()
  if (gate.code !== 0) return gate

  try {
    console.log('查询客户表字段结构...\n')
    
    const result = await db.collection('customers').limit(5).get()
    
    if (result.data.length === 0) {
      return {
        success: false,
        message: '客户表为空'
      }
    }
    
    const customers = result.data
    
    const response = {
      success: true,
      message: '查询成功',
      sampleData: customers,
      totalCustomers: 0,
      withRegion: 0,
      fieldStats: {}
    }
    
    // 统计字段
    const fields = {}
    customers.forEach(customer => {
      Object.keys(customer).forEach(field => {
        fields[field] = (fields[field] || 0) + 1
      })
    })
    response.fieldStats = fields
    
    // 统计区域
    const withRegion = customers.filter(c => c.region).length
    response.withRegion = withRegion
    
    // 获取总数
    const allCount = await db.collection('customers').count()
    response.totalCustomers = allCount.total
    
    // 获取有区域的总数
    const regionCount = await db.collection('customers')
      .where({
        region: db.command.neq(null)
      })
      .count()
    response.totalWithRegion = regionCount.total
    
    // 获取区域分布
    const sampleRegion = await db.collection('customers')
      .field({ region: true })
      .limit(100)
      .get()
    
    const regionDist = {}
    sampleRegion.data.forEach(c => {
      const r = c.region || '(空)'
      regionDist[r] = (regionDist[r] || 0) + 1
    })
    
    response.regionDistribution = Object.entries(regionDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
    
    return response
  } catch (err) {
    console.error('查询失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
