/**
 * 检查数据库字段
 */

const fs = require('fs')
const path = require('path')

// 读取.env 文件
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

async function checkFields() {
  console.log('\n检查数据库字段...\n')
  
  // 检查商品
  console.log('【商品表】前 3 条记录:')
  try {
    const products = await app.database().collection('products').limit(3).get()
    products.data.forEach((p, i) => {
      console.log(`\n商品 ${i + 1}:`)
      console.log('  所有字段:', Object.keys(p))
      console.log('  name:', p.name)
      console.log('  material_code:', p.material_code)
      console.log('  spec:', p.spec)
      console.log('  pricing_mode:', p.pricing_mode)
      console.log('  unit_piece_qty:', p.unit_piece_qty)
      console.log('  price_piece:', p.price_piece)
      console.log('  price_unit:', p.price_unit)
      console.log('  unit:', p.unit)
    })
  } catch (e) {
    console.log('错误:', e.message)
  }
  
  // 检查客户
  console.log('\n\n【客户表】前 3 条记录:')
  try {
    const customers = await app.database().collection('customers').limit(3).get()
    customers.data.forEach((c, i) => {
      console.log(`\n客户 ${i + 1}:`)
      console.log('  所有字段:', Object.keys(c))
      console.log('  name:', c.name)
      console.log('  alias:', c.alias)
      console.log('  shortName:', c.shortName)
      console.log('  contact:', c.contact)
      console.log('  phone:', c.phone)
      console.log('  region:', c.region)
    })
  } catch (e) {
    console.log('错误:', e.message)
  }
}

checkFields()
