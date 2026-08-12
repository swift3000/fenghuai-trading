/**
 * 调用测试云函数
 */

const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({
  env: 'your-env-id' // 这里需要替换为你的云环境 ID
})

async function runTest() {
  console.log('调用测试云函数...\n')
  
  try {
    const result = await app.callFunction({
      name: 'test-order-flow',
      data: {}
    })
    
    console.log('测试结果:')
    console.log(JSON.stringify(result.result, null, 2))
    
  } catch (e) {
    console.error('调用失败:', e)
  }
}

runTest()
