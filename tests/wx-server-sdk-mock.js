// 仅测试用 wx-server-sdk mock（不部署）
module.exports = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext() { return { OPENID: (typeof global !== 'undefined' && global.__SMART_OPENID__) || null } },
  database() {
    return { collection(name) {
      return {
        get() { return { data: name === 'products' ? (global.__SMART_PRODUCTS__ || []) : [] } },
        where(q) { return { get() { return { data: name === 'users' && q.openid === (global.__SMART_OPENID__ || null) ? [{ _id: 'u1', openid: global.__SMART_OPENID__, role: 'admin' }] : [] } } } },
        doc() { return { get() { return Promise.resolve({ data: (global.__SMART_STATE__ && global.__SMART_STATE__.system_config) || {} }) } } }
      }
    } }
  }
}
