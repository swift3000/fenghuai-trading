const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
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
