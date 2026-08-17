/**
 * 云函数请求封装
 */
function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data !== undefined ? res.result.data : res.result)
        } else {
          const message = (res.result && res.result.message) || '请求失败'
          console.error('云函数业务错误:', name, res.result && res.result.code, message)
          wx.showToast({ title: message, icon: 'none' })
          reject(res.result)
        }
      },
      fail: err => {
        console.error('云函数调用失败:', name, err && err.errMsg)
        wx.showToast({ title: '网络错误', icon: 'none' })
        reject(err)
      }
    })
  })
}

function callCloudRaw(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => {
        resolve(res.result)
      },
      fail: err => {
        console.error('云函数调用失败:', name, err && err.errMsg)
        wx.showToast({ title: '网络错误', icon: 'none' })
        reject(err)
      }
    })
  })
}

module.exports = { callCloud, callCloudRaw }
