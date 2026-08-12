const cloud = require('@cloudbase/node-sdk')

const app = cloud.init({
  env: 'cloud1-d6g75loi673b1e039'
})

async function checkCustomerFields() {
  console.log('调用 check-customer-fields 云函数...\n')
  
  try {
    const result = await app.callFunction({
      name: 'check-customer-fields'
    })
    
    console.log('=== 云函数返回结果 ===\n')
    console.log(JSON.stringify(result.result, null, 2))
    
  } catch (err) {
    console.error('调用失败:', err)
  }
}

checkCustomerFields()
