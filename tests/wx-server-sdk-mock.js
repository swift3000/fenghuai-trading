// 仅测试用 wx-server-sdk mock（不部署）
module.exports = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext() { return { OPENID: null } },
  database() {
    return { collection(name) {
      return {
        get() { return { data: name === 'products' ? (global.__SMART_PRODUCTS__ || []) : [] } },
        doc() { return { get() { return Promise.resolve({ data: (global.__SMART_STATE__ && global.__SMART_STATE__.system_config) || {} }) } } }
      }
    } }
  }
}
