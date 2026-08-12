const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log('查询客户表字段结构...');
    const result = await db.collection('customers').limit(5).get();
    
    if (result.data.length === 0) {
      return {
        success: false,
        message: '客户表为空'
      };
    }
    
    const customers = result.data;
    
    console.log('\n=== 客户数据示例 ===');
    customers.forEach((customer, index) => {
      console.log('\n客户 ' + (index + 1) + ':');
      console.log(JSON.stringify(customer, null, 2));
    });
    
    console.log('\n=== 字段统计 ===');
    const fields = {};
    customers.forEach(customer => {
      Object.keys(customer).forEach(field => {
        fields[field] = (fields[field] || 0) + 1;
      });
    });
    console.log('字段:', fields);
    
    // 检查 region 字段
    const withRegion = customers.filter(c => c.region).length;
    
    // 统计所有字段
    const allCustomers = await db.collection('customers').count();
    const regionStats = await db.collection('customers')
      .where({
        region: db.command.exists(true)
      })
      .count();
    
    return {
      success: true,
      total: allCustomers.total,
      sample: customers,
      fields: fields,
      withRegion: regionStats.total,
      message: `共 ${allCustomers.total} 个客户，${regionStats.total} 个有区域字段`
    };
  } catch (err) {
    console.error('查询失败:', err);
    return {
      success: false,
      error: err.message
    };
  }
};
