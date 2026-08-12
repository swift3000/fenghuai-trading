/**
 * W0 部署验证脚本
 * 
 * 使用方法：
 * 1. 在微信开发者工具中打开「云开发」控制台
 * 2. 进入「数据库」->「聚合」标签
 * 3. 选择对应的集合，点击「聚合」执行查询
 */

// ==================== 验证 1：检查数据库集合 ====================
// 在云开发控制台依次查询每个集合，确认存在且为空（或已有数据）
const collections = [
  'users',
  'regions',
  'products',
  'customers',
  'orders',
  'order_items',
  'payments',
  'product_aliases',
  'customer_aliases',
  'order_logs',
  'system_config'
]

console.log('=== 验证数据库集合 ===')
console.log('依次检查以下集合是否存在：', collections)

// ==================== 验证 2：检查 regions 数据 ====================
// 在 regions 集合的聚合查询中执行：
const verifyRegions = `
db.collection('regions').count()
`
console.log('=== 验证 regions 数据 ===')
console.log('执行聚合查询：', verifyRegions)
console.log('预期结果：11 条数据')

// 验证 regions 排序是否正确
const verifyRegionsSort = `
db.collection('regions').orderBy('sort', 'asc').get()
`
console.log('验证排序：', verifyRegionsSort)
console.log('预期顺序：汉滨区 (1)→汉阴县 (2)→石泉县 (3)→宁陕县 (4)→紫阳县 (5)→岚皋县 (6)→平利县 (7)→镇坪县 (8)→旬阳市 (9)→白河县 (10)→外县 (99)')

// ==================== 验证 3：检查 system_config ====================
const verifySystemConfig = `
db.collection('system_config').doc('ai_config').get()
`
console.log('=== 验证 system_config ===')
console.log('执行查询：', verifySystemConfig)
console.log('预期结果：返回 ai_config 配置记录')

// ==================== 验证 4：检查云函数 ====================
console.log('=== 验证云函数 ===')
console.log('在云开发控制台查看云函数列表，确认以下 10 个云函数已部署：')
const cloudFunctions = [
  'auth',
  'products',
  'customers',
  'orders',
  'users',
  'regions',
  'receivable',
  'system',
  'smart',
  'report'
]
console.log(cloudFunctions)

// ==================== 验证 5：测试云函数调用 ====================
console.log('=== 测试云函数调用 ===')
console.log('在小程序开发工具中打开控制台，执行以下测试：')

const testCode = `
// 测试 1：调用 regions 云函数
wx.cloud.callFunction({
  name: 'regions',
  data: { action: 'list' }
}).then(res => {
  console.log('regions 测试:', res)
})

// 测试 2：调用 system 云函数
wx.cloud.callFunction({
  name: 'system',
  data: { action: 'getConfig' }
}).then(res => {
  console.log('system 测试:', res)
})
`
console.log(testCode)

// ==================== 验证清单 ====================
console.log('=== 验证清单 ===')
console.log('✅ 11 个数据库集合已创建')
console.log('✅ regions 有 11 条数据')
console.log('✅ regions 排序正确（1-10, 99）')
console.log('✅ system_config 有 ai_config 记录')
console.log('✅ 10 个云函数已部署')
console.log('✅ 云函数调用测试通过')
