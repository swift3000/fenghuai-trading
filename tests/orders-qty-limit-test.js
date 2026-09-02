/**
 * T66-R18-A1（graph 第18轮 P1）：手动录单数量归一上限单测
 * 对齐 smart T57-RA-3 口径：整数化 + 上限 9999 + 负数/非有限数→0 + 显式 0 保留
 * 运行：node tests/orders-qty-limit-test.js
 */
const assert = require('assert')
const Module = require('module')
const path = require('path')

const stats = { total: 0, passed: 0, failed: 0, errors: [] }
function test(name, fn) {
  stats.total++
  return Promise.resolve().then(fn).then(() => {
    stats.passed++
    console.log('✅ ' + name)
  }).catch(e => {
    stats.failed++
    stats.errors.push({ name, error: (e && e.message) || e })
    console.log('❌ ' + name + ': ' + ((e && e.message) || e))
  })
}

async function loadOrders() {
  const sdkMockPath = path.join(__dirname, 'wx-server-sdk-mock.js')
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'wx-server-sdk') return sdkMockPath
    return origResolve.apply(this, arguments)
  }
  require.cache[sdkMockPath] = { id: sdkMockPath, filename: sdkMockPath, loaded: true, exports: require(sdkMockPath) }
  const ordersPath = path.join(__dirname, '..', 'cloudfunctions', 'orders', 'index.js')
  return require(ordersPath)
}

;(async () => {
  const orders = await loadOrders()
  const nq = orders.normalizeQtyLocal
  assert.ok(typeof nq === 'function', 'normalizeQtyLocal 必须导出')
  assert.strictEqual(orders.ORDERS_QTY_MAX, 9999, '上限常量必须是 9999（对齐 smart SMART_QTY_MAX）')

  await test('正常整数原样', () => assert.strictEqual(nq(10), 10))
  await test('小数向上取整（2.5→3）', () => assert.strictEqual(nq(2.5), 3))
  await test('上限截断（99999→9999）', () => assert.strictEqual(nq(99999), 9999))
  await test('边界值 9999 保留', () => assert.strictEqual(nq(9999), 9999))
  await test('9999.1 截断到 9999', () => assert.strictEqual(nq(9999.1), 9999))
  await test('显式 0 保留（0 元红线由过滤层处理）', () => assert.strictEqual(nq(0), 0))
  await test('负数→0（不得落库负数量）', () => assert.strictEqual(nq(-5), 0))
  await test('NaN→0', () => assert.strictEqual(nq(NaN), 0))
  await test('非数值字符串→0', () => assert.strictEqual(nq('abc'), 0))
  await test('数值字符串可解析', () => assert.strictEqual(nq('12'), 12))
  await test('undefined→0', () => assert.strictEqual(nq(undefined), 0))
  await test('Infinity→0', () => assert.strictEqual(nq(Infinity), 0))

  console.log('\n' + stats.passed + '/' + stats.total + ' passed')
  if (stats.failed > 0) {
    console.log('FAILURES:')
    stats.errors.forEach(e => console.log(' - ' + e.name + ': ' + e.error))
    process.exit(1)
  }
})().catch(e => {
  console.error('套件加载失败: ' + (e && e.message) || e)
  process.exit(1)
})
