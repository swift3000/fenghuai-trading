const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({
  env: 'cloud1-d6g75loi673b1e039'
})

const db = app.database()

async function checkCustomers() {
  console.log('查询客户表字段结构...\n')
  
  try {
    const result = await db.collection('customers').limit(5).get()
    
    if (result.data.length === 0) {
      console.log('客户表为空')
      return
    }
    
    console.log('=== 客户数据示例 ===\n')
    result.data.forEach((customer, index) => {
      console.log(`客户 ${index + 1}:`)
      console.log(JSON.stringify(customer, null, 2))
      console.log('')
    })
    
    console.log('=== 字段统计 ===')
    const fields = {}
    result.data.forEach(customer => {
      Object.keys(customer).forEach(field => {
        fields[field] = (fields[field] || 0) + 1
      })
    })
    console.log('字段:', fields)
    
    // 检查 region 字段
    const withRegion = result.data.filter(c => c.region).length
    console.log('\n有区域字段的客户数:', withRegion, '/', result.data.length)
    
    // 检查所有客户的 region 字段统计
    const allCustomers = await db.collection('customers').count()
    const regionExists = await db.collection('customers')
      .where({
        region: db.command.exists(true)
      })
      .count()
    
    const regionNotNull = await db.collection('customers')
      .where({
        region: db.command.neq(null)
      })
      .count()
    
    console.log('\n=== 全部客户统计 ===')
    console.log('总客户数:', allCustomers.total)
    console.log('有 region 字段:', regionExists.total)
    console.log('region 不为空:', regionNotNull.total)
    
    // 获取所有客户来统计区域
    const allCustomersData = await db.collection('customers')
      .field({ region: true })
      .limit(100)
      .get()
    
    console.log('\n=== 区域分布 (样本 100 个) ===')
    const regionCount = {}
    allCustomersData.data.forEach(c => {
      const r = c.region || '(空)'
      regionCount[r] = (regionCount[r] || 0) + 1
    })
    
    Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([region, count]) => {
        console.log(`${region}: ${count}`)
      })
    
  } catch (err) {
    console.error('查询失败:', err)
  }
}

checkCustomers()
