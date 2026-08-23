/**
 * 智能录入 AI 降级逻辑测试（独立异步套件）
 * parseWithAI：规则优先 -> 中转站 relay -> 千问 qwen 逐级降级
 *
 * 运行：node tests/smart-ai-test.js
 */
const assert = require('assert')
const Module = require('module')
const path = require('path')

const stats = { total: 0, passed: 0, failed: 0, errors: [] }
function test(name, fn) {
  stats.total++
  return Promise.resolve().then(fn).then(() => {
    stats.passed++
    console.log(`✅ ${name}`)
  }).catch(e => {
    stats.failed++
    stats.errors.push({ name, error: (e && e.message) || e })
    console.log(`❌ ${name}: ${(e && e.message) || e}`)
  })
}

async function loadSmartRun() {
  // 注入 wx-server-sdk mock：doc().get() 实时读全局
  // 将 'wx-server-sdk' 重定向到测试 mock，避免 require.resolve 找不到
  const sdkMockPath = path.join(__dirname, 'wx-server-sdk-mock.js')
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'wx-server-sdk') return sdkMockPath
    return origResolve.apply(this, arguments)
  }
  require.cache[sdkMockPath] = { id: sdkMockPath, filename: sdkMockPath, loaded: true, exports: require(sdkMockPath) }

  const smartPath = path.join(__dirname, '..', 'cloudfunctions', 'smart', 'index.js')
  const smart = require(smartPath)

  const https = require('https')
  const origRequest = https.request
  global.__SMART_PRODUCTS__ = [{ _id: 'p1', material_code: '001', name: '乐事薯片', spec: '1x60', price_piece: 45, price_unit: 0.75, pricing_mode: 'case', unit: '包' }]
  global.__SMART_OPENID__ = 'test-openid-admin'

  return (opts) => {
    const byHost = opts.byHost || {}
    const ai = opts.ai || {}
    global.__SMART_STATE__ = { system_config: { ai } }
    let calls = []
    https.request = (o, cb) => {
      const host = o.hostname || ''
      calls.push(host)
      const sc = byHost[host]
      let errHandler = null
      const req = {
        on: (ev, fn) => { if (ev === 'error') errHandler = fn; return req },
        setTimeout() { return req }, write() {}, end() {}, destroy() {}
      }
      if (sc && sc.error) process.nextTick(() => errHandler && errHandler(new Error(sc.error)))
      const payload = JSON.stringify({ choices: [{ message: { content: (sc && sc.content) || '' } }] })
      const fakeRes = { on: (ev, fn) => { if (ev === 'data') fn(payload); if (ev === 'end') fn(); return fakeRes }, setEncoding() {}, setState() {} }
      process.nextTick(() => cb(fakeRes))
      return req
    }
    return smart.main(opts).then(res => { https.request = origRequest; return { res, calls } })
  }
}

;(async () => {
  const run = await loadSmartRun()

  // 1. 规则命中 -> 直接用规则引擎，不调 AI
  await test('规则命中时直接用规则引擎，不调 AI', async () => {
    const r = await run({ action: 'parseWithAI', text: '乐事薯片 2件 包', ai: { relay: { enabled: true, baseUrl: 'https://relay.com/v1', apiKey: 'k1', model: 'qwen-0810' } } })
    assert.strictEqual(r.res.data.engine, 'rule', '应使用规则引擎')
    assert.strictEqual(r.calls.length, 0, '规则命中不应调 AI')
  })

  // 2. 规则未命中 + 配中转站 -> 调用中转站并 AI 兜底
  await test('规则未命中 + 配中转站 -> 调用中转站并 AI 兜底', async () => {
    const r = await run({
      action: 'parseWithAI', text: '洋芋片来两件',
      ai: { relay: { enabled: true, baseUrl: 'https://relay.com/v1', apiKey: 'k1', model: 'qwen-0810' } },
      byHost: { 'relay.com': { content: '[{"name":"洋芋片","qty":2,"unit":"件"}]' } }
    })
    assert.ok(r.calls.includes('relay.com'), '应调用中转站 relay.com，实际 ' + JSON.stringify(r.calls))
    assert.strictEqual(r.res.data.engine, 'ai', '应由 AI 兜底')
    assert.ok(r.res.data.items.length > 0, '应有解析结果')
  })

  // 3. 中转站失败 -> 降级 TokenHub，AI 兜底（NLP 引擎已迁移 TokenHub，降级链 = relay -> tokenhub）
  await test('中转站失败(网络错) -> 降级TokenHub，AI 兜底', async () => {
    const r = await run({
      action: 'parseWithAI', text: '洋芋片来三件',
      ai: {
        relay: { enabled: true, baseUrl: 'https://relay.com/v1', apiKey: 'k1', model: 'qwen-0810' },
        tokenhub: { enabled: true, apiKey: 'kth', baseUrl: 'https://tokenhub.com/v1', models: ['hy3'] }
      },
      byHost: { 'relay.com': { error: 'boom' }, 'tokenhub.com': { content: '[{"name":"洋芋片","qty":3,"unit":"件"}]' } }
    })
    assert.ok(r.calls.includes('tokenhub.com'), '中转站失败后应降级TokenHub，实际 ' + JSON.stringify(r.calls))
    assert.strictEqual(r.res.data.engine, 'ai', '最终由 AI 兜底')
    assert.ok(r.res.data.items.length > 0, '应有解析结果')
  })

  // 4. 全部引擎失败 -> 回落规则引擎
  await test('全部引擎失败 -> 回落规则引擎', async () => {
    const r = await run({
      action: 'parseWithAI', text: '洋芋片来三件',
      ai: {
        relay: { enabled: true, baseUrl: 'https://relay.com/v1', apiKey: 'k1', model: 'qwen-0810' },
        tokenhub: { enabled: true, apiKey: 'kth', baseUrl: 'https://tokenhub.com/v1', models: ['hy3'] }
      },
      byHost: { 'relay.com': { error: 'boom' }, 'tokenhub.com': { error: 'boom2' } }
    })
    assert.strictEqual(r.res.data.engine, 'rule', '引擎全失败应回落规则引擎')
  })

  console.log('\n' + '='.repeat(50))
  console.log('📊 智能录入 AI 降级逻辑测试总结')
  console.log('='.repeat(50))
  console.log(`总测试数：${stats.total}`)
  console.log(`✅ 通过：${stats.passed}`)
  console.log(`❌ 失败：${stats.failed}`)
  if (stats.errors.length) {
    stats.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`))
  }
  console.log('='.repeat(50))
  process.exit(stats.failed ? 1 : 0)
})().catch(e => { console.error('❌ 测试框架错误:', e.message); process.exit(1) })
