#!/usr/bin/env node

/**
 * 数据导入执行脚本
 * 使用 cloudbase cli 调用云函数
 */

const { execSync } = require('child_process')
const path = require('path')

const ENV_ID = 'cloud1-d6g75loi673b1e039'

console.log('╔════════════════════════════════════════╗')
console.log('║   钱多多 - 数据导入开始              ║')
console.log('╚════════════════════════════════════════╝\n')

console.log('环境 ID:', ENV_ID)
console.log('开始导入数据...\n')

// 导入客户数据
console.log('【1/3】导入客户数据...')
try {
  const customerResult = execSync(
    `cloudbase fn invoke import-data -d '{"action":"import-customers"}' --env ${ENV_ID}`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  )
  console.log(customerResult)
} catch (error) {
  console.error('客户导入失败:', error.message)
  console.error(error.stdout)
}

// 导入商品数据
console.log('\n【2/3】导入商品数据...')
try {
  const productResult = execSync(
    `cloudbase fn invoke import-data -d '{"action":"import-products"}' --env ${ENV_ID}`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  )
  console.log(productResult)
} catch (error) {
  console.error('商品导入失败:', error.message)
  console.error(error.stdout)
}

// 验证数据
console.log('\n【3/3】验证数据...')
try {
  const verifyResult = execSync(
    `cloudbase fn invoke import-data -d '{"action":"verify"}' --env ${ENV_ID}`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  )
  console.log(verifyResult)
} catch (error) {
  console.error('验证失败:', error.message)
}

console.log('\n╔════════════════════════════════════════╗')
console.log('║   数据导入完成                         ║')
console.log('╚════════════════════════════════════════╝')
