const cloud = require('wx-server-sdk');scloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
 const db = cloud.database();

exports.main = async (event, context) => {
  const collections = ['users', 'orders', 'products', 'customers', 'receivable'];
  const results = [];
  
  console.log('🔧 开始初始化数据库...');
  
  for (const name of collections) {
    try {
      // 先尝试查询，如果集合不存在会报错
      await db.collection(name).limit(1).get();
      results.push({ name, status: 'exists', message: '集合已存在' });
      console.log(`✅ 集合已存在：${name}`);
    } catch (err) {
      // 集合不存在，尝试创建
      try {
        // 添加一条测试数据来触发集合创建
        await db.collection(name).add({
          data: {
            _created: Date.now(),
            _note: '初始化测试数据',
            _test: true
          }
        });
        results.push({ name, status: 'created', message: '集合已创建' });
        console.log(`✅ 已创建集合：${name}`);
      } catch (createErr) {
        // 如果还是失败，可能是权限问题，记录错误但继续
        console.log(`⚠️  集合 ${name} 创建失败：${createErr.errMsg}`);
        console.log(`💡 提示：请在云开发控制台手动创建集合 "${name}"`);
        results.push({ 
          name, 
          status: 'manual_create_required', 
          message: '需要手动创建',
          error: createErr.errMsg 
        });
      }
    }
  }
  
  console.log('✅ 数据库初始化完成');
  
  return {
    code: 0,
    message: '数据库初始化完成',
    data: results,
    summary: {
      total: collections.length,
      created: results.filter(r => r.status === 'created').length,
      exists: results.filter(r => r.status === 'exists').length,
      errors: results.filter(r => r.status === 'manual_create_required').length
    }
  };
};
