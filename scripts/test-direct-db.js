/**
 * 直接操作数据库，不使用 SDK 封装
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=#]+)=(.+)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({
  env: envVars.CLOUDBASE_ENV_ID,
  secretId: envVars.CLOUDBASE_SECRET_ID,
  secretKey: envVars.CLOUDBASE_SECRET_KEY
})

async function testDirect() {
  console.log('\n测试直接数据库操作...\n')
  
  // 先删除所有数据
  console.log('删除所有数据...')
  const allProducts = await app.database().collection('products').get()
  console.log(`找到 ${allProducts.data.length} 个商品`)
  
  for (const p of allProducts.data) {
    await app.database().collection('products').doc(p._id).remove()
  }
  console.log('已清空')
  
  // 直接插入一条测试数据
  console.log('\n插入测试数据...')
  const result = await app.database().collection('products').add({
    data: {
      name: '测试商品',
      material_code: 'TEST001',
      spec: '测试规格',
      pricing_mode: 'case',
      unit_piece_qty: 10,
      price_piece: 100,
      price_unit: 10,
      unit: '包',
      test_field: 'test_value'
    }
  })
  
  console.log('插入结果 ID:', result.id)
  
  // 查询验证
  console.log('\n查询验证...')
  const testProduct = await app.database().collection('products').doc(result.id).get()
  console.log('查询结果字段:', Object.keys(testProduct.data))
  console.log('name:', testProduct.data.name)
  console.log('material_code:', testProduct.data.material_code)
  console.log('price_piece:', testProduct.data.price_piece)
  console.log('price_unit:', testProduct.data.price_unit)
  
  // 清理
  await app.database().collection('products').doc(result.id).remove()
  console.log('\n✅ 测试完成')
}

testDirect()
