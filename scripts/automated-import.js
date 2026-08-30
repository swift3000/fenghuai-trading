#!/usr/bin/env node

/**
 * 自动化数据导入脚本
 * 使用微信云开发 Node.js SDK 批量导入商品和客户数据
 */

const cloud = require('@cloudbase/node-sdk')
const fs = require('fs')
const path = require('path')

// 加载环境变量
const envFile = path.join(__dirname, '..', '.env')
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  lines.forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const eqIndex = line.indexOf('=')
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim()
        const value = line.substring(eqIndex + 1).trim()
        process.env[key] = value
      }
    }
  })
}

const CLOUDBASE_SECRET_ID = process.env.CLOUDBASE_SECRET_ID
const CLOUDBASE_SECRET_KEY = process.env.CLOUDBASE_SECRET_KEY
const CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID

console.log('环境变量检查:')
console.log(`  CLOUDBASE_ENV_ID: ${CLOUDBASE_ENV_ID ? '✓' : '✗'}`)
console.log(`  CLOUDBASE_SECRET_ID: ${CLOUDBASE_SECRET_ID ? '✓' : '✗'}`)
console.log(`  CLOUDBASE_SECRET_KEY: ${CLOUDBASE_SECRET_KEY ? '✓' : '✗'}`)
console.log('')

if (!CLOUDBASE_SECRET_ID || !CLOUDBASE_SECRET_KEY) {
  console.error('❌ 错误：缺少云开发 API 密钥配置')
  console.error('请确保 .env 文件中包含 CLOUDBASE_SECRET_ID 和 CLOUDBASE_SECRET_KEY')
  process.exit(1)
}

// 初始化云开发
const app = cloud.init({
  env: CLOUDBASE_ENV_ID,
  secretId: CLOUDBASE_SECRET_ID,
  secretKey: CLOUDBASE_SECRET_KEY
})

const db = app.database()

// 加载数据文件
const productsFile = path.join(__dirname, 'products-all.json')
const customersFile = path.join(__dirname, 'customers-all.json')

if (!fs.existsSync(productsFile)) {
  console.error('❌ 错误：找不到商品数据文件', productsFile)
  process.exit(1)
}

if (!fs.existsSync(customersFile)) {
  console.error('❌ 错误：找不到客户数据文件', customersFile)
  process.exit(1)
}

const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'))
const customers = JSON.parse(fs.readFileSync(customersFile, 'utf8'))

console.log('📦 准备导入数据:')
console.log(`  - 商品：${products.length} 条`)
console.log(`  - 客户：${customers.length} 条`)
console.log('')

// 批量导入商品
async function importProducts() {
  console.log('📦 正在导入商品数据...')
  const results = {
    success: 0,
    failed: 0,
    errors: []
  }

  // 分批处理，每批 500 条
  const batchSize = 500
  const batches = []
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize))
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`  批次 ${i + 1}/${batches.length}: ${batch.length} 条记录`)

    try {
      // 准备数据（添加时间戳）
      const batchData = batch.map(product => ({
        ...product,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      // 先检查并删除已存在的记录（material_code 相同）
      for (const product of batchData) {
        const existing = await db.collection('products')
          .where({ material_code: product.material_code })
          .get()

        if (existing.data.length > 0) {
          await db.collection('products')
            .doc(existing.data[0]._id)
            .remove()
        }
      }

      // 插入新记录（逐个插入）
      for (const product of batchData) {
        await db.collection('products').add(product)
      }

      results.success += batch.length
    } catch (err) {
      // SC-1：参数分列不拼格式串
      console.error('  ❌ 批次', i + 1, '失败:', err.message)
      results.failed += batch.length
      results.errors.push({ batch: i + 1, error: err.message })
    }
  }

  console.log(`✅ 商品导入完成：成功 ${results.success}, 失败 ${results.failed}`)
  return results
}

// 批量导入客户
async function importCustomers() {
  console.log('')
  console.log('📦 正在导入客户数据...')
  const results = {
    success: 0,
    failed: 0,
    errors: []
  }

  // 分批处理，每批 500 条
  const batchSize = 500
  const batches = []
  for (let i = 0; i < customers.length; i += batchSize) {
    batches.push(customers.slice(i, i + batchSize))
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`  批次 ${i + 1}/${batches.length}: ${batch.length} 条记录`)

    try {
      // 准备数据（添加时间戳）
      const batchData = batch.map(customer => ({
        ...customer,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      // 先检查并删除已存在的记录（name 相同）
      for (const customer of batchData) {
        const existing = await db.collection('customers')
          .where({ name: customer.name })
          .get()

        if (existing.data.length > 0) {
          await db.collection('customers')
            .doc(existing.data[0]._id)
            .remove()
        }
      }

      // 插入新记录（逐个插入）
      for (const customer of batchData) {
        await db.collection('customers').add(customer)
      }

      results.success += batch.length
    } catch (err) {
      // SC-1：参数分列不拼格式串
      console.error('  ❌ 批次', i + 1, '失败:', err.message)
      results.failed += batch.length
      results.errors.push({ batch: i + 1, error: err.message })
    }
  }

  console.log(`✅ 客户导入完成：成功 ${results.success}, 失败 ${results.failed}`)
  return results
}

// 主函数
async function main() {
  console.log('========================================')
  console.log('🚀 开始导入数据到微信云开发')
  console.log(`环境：${CLOUDBASE_ENV_ID}`)
  console.log('========================================')
  console.log('')

  try {
    const productResults = await importProducts()
    const customerResults = await importCustomers()

    console.log('')
    console.log('========================================')
    console.log('✅ 数据导入完成！')
    console.log('========================================')
    console.log('')
    console.log('📊 统计:')
    console.log(`  商品：成功 ${productResults.success}, 失败 ${productResults.failed}`)
    console.log(`  客户：成功 ${customerResults.success}, 失败 ${customerResults.failed}`)
    console.log('')

    if (productResults.errors.length > 0 || customerResults.errors.length > 0) {
      console.log('⚠️ 错误详情:')
      ;[...productResults.errors, ...customerResults.errors].forEach(err => {
        console.log(`  - ${err.error}`)
      })
    }

    process.exit(0)
  } catch (err) {
    console.error('')
    console.error('❌ 导入失败:', err.message)
    console.error('')
    process.exit(1)
  }
}

main()
