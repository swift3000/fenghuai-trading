/**
 * 检查数据库原始数据
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

async function checkRawData() {
  console.log('\n检查数据库原始数据...\n')
  
  const products = await app.database().collection('products').limit(2).get()
  
  console.log('原始返回数据:')
  console.log(JSON.stringify(products, null, 2))
  
  console.log('\n\ndata 数组内容:')
  products.data.forEach((item, i) => {
    console.log(`\n项目 ${i}:`, typeof item, Array.isArray(item) ? '(数组)' : '(对象)')
    if (typeof item === 'object') {
      console.log('  键:', Object.keys(item))
      console.log('  值:', JSON.stringify(item))
    }
  })
}

checkRawData()
