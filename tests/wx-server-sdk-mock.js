// 仅测试用 wx-server-sdk mock（不部署）
module.exports = {
  DYNAMIC_CURRENT_ENV: 'test',
  init() {},
  getWXContext() { return { OPENID: (typeof global !== 'undefined' && global.__SMART_OPENID__) || null } },
  database() {
    return { collection(name) {
      // T56：fetchAll 走 query.skip(n).limit(m).get() 分页，mock 需支持链式 limit/skip/count
      const base = name === 'users'
        ? [{ _id: 'u1', openid: (typeof global !== 'undefined' && global.__SMART_OPENID__) || null, role: 'admin' }]
        : []
      const products = name === 'products' ? (global.__SMART_PRODUCTS__ || []) : []
      const src = name === 'users' ? base : (name === 'products' ? products : [])
      const filter = (q) => {
        let arr = src
        if (q) {
          for (const k of Object.keys(q)) {
            if (k === 'openid') arr = arr.filter(d => d.openid === q[k])
          }
        }
        return arr
      }
      const q = {
        where(wh) { q._q = wh; return q },
        limit() { return q },
        skip() { return q },
        count() { return Promise.resolve({ total: filter(q._q).length }) },
        get() { return Promise.resolve({ data: filter(q._q) }) }
      }
      return {
        get() { return Promise.resolve({ data: filter(null) }) },
        where: q.where,
        limit: q.limit,
        skip: q.skip,
        count: q.count,
        doc() { return { get() { return Promise.resolve({ data: (global.__SMART_STATE__ && global.__SMART_STATE__.system_config) || {} }) } } }
      }
    } }
  }
}
