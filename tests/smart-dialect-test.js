/**
 * T41 方言适配单测（纯本地规则引擎，无网络无云依赖）
 * 覆盖：中文数字量词 / 同音字归一化 / 整句无空格滑窗 / 一行多商品
 *
 * 运行：node tests/smart-dialect-test.js
 */
const assert = require('assert')
const Module = require('module')
const path = require('path')

const sdkMockPath = path.join(__dirname, 'wx-server-sdk-mock.js')
const origResolve = Module._resolveFilename
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === 'wx-server-sdk') return sdkMockPath
  return origResolve.apply(this, arguments)
}

const smart = require(path.join(__dirname, '..', 'cloudfunctions', 'smart', 'index.js'))

const products = [
  { _id: 'p1', name: '白吉馍', spec: '1x50', price_piece: 25 },
  { _id: 'p2', name: '手抓饼', spec: '1x40', price_piece: 38 },
  { _id: 'p3', name: '怀念菜饺', spec: '1x6', price_piece: 85 },
  { _id: 'p4', name: '老酸奶', spec: '1x30', price_piece: 45 },
  { _id: 'p5', name: '永和豆浆', spec: '1x60', price_piece: 72 },
  { _id: 'p6', name: '淮盐400g', spec: '1x50', price_piece: 36 },
  { _id: 'p7', name: '有情郎米酒', spec: '1x30', price_piece: 33 }
]

let total = 0, passed = 0, failed = 0
function test(name, fn) {
  total++
  try {
    fn()
    passed++
    console.log('✅ ' + name)
  } catch (e) {
    failed++
    console.log('❌ ' + name + ': ' + (e && e.message))
  }
}

// ---- 中文数字量词 ----
test('中文数字：两包', () => assert.strictEqual(smart.extractQuantity('来两包'), 2))
test('中文数字：三件', () => assert.strictEqual(smart.extractQuantity('要三件'), 3))
test('中文数字：十二箱', () => assert.strictEqual(smart.extractQuantity('十二箱'), 12))
test('中文数字：二十瓶', () => assert.strictEqual(smart.extractQuantity('二十瓶'), 20))
test('中文数字：二十五袋', () => assert.strictEqual(smart.extractQuantity('二十五袋'), 25))
test('阿拉伯数字不回归：3包', () => assert.strictEqual(smart.extractQuantity('3包'), 3))
test('商品名内数字不误判量词（400克晶纯盐）', () => {
  const items = smart.parseOrderText('400克晶纯盐来两箱', [{ _id: 'px', name: '400克晶纯盐', price_piece: 25 }])
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].qty, 2)
})

// ---- 同音字归一化 ----
test('同音字：白吉魔 → 白吉馍', () => {
  const p = smart.extractProductName('白吉魔', products)
  assert.strictEqual(p && p.name, '白吉馍')
})
test('同音字：病饼 → 手抓饼（段内病归一）', () => {
  assert.strictEqual(smart.normalizeHomophones('病'), '饼')
})
test('标准字不误伤：老酸奶 正常匹配', () => {
  const p = smart.extractProductName('老酸奶', products)
  assert.strictEqual(p && p.name, '老酸奶')
})
test('同音字整句：白吉魔两个', () => {
  const items = smart.parseOrderText('白吉魔两个', products)
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].name, '白吉馍')
  assert.strictEqual(items[0].qty, 2)
})

// ---- 整句无空格滑窗 / 一行多商品 ----
test('整句无空格单商品：要两个白吉馍', () => {
  const items = smart.parseOrderText('要两个白吉馍', products)
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].name, '白吉馍')
  assert.strictEqual(items[0].qty, 2)
})
test('一行多商品：白吉馍两个 老酸奶三件', () => {
  const items = smart.parseOrderText('白吉馍两个 老酸奶三件', products)
  assert.strictEqual(items.length, 2)
  const a = items.find(i => i.name === '白吉馍')
  const b = items.find(i => i.name === '老酸奶')
  assert.strictEqual(a.qty, 2)
  assert.strictEqual(b.qty, 3)
})
test('一行多商品无空格：手抓饼三件老酸奶两件', () => {
  const items = smart.parseOrderText('手抓饼三件老酸奶两件', products)
  assert.ok(items.length >= 2, '应解析出 2 个商品，实际 ' + items.length + ': ' + JSON.stringify(items))
  const a = items.find(i => i.name === '手抓饼')
  const b = items.find(i => i.name === '老酸奶')
  assert.strictEqual(a && a.qty, 3)
  assert.strictEqual(b && b.qty, 2)
})
test('菜角→菜饺 同音字匹配', () => {
  const p = smart.extractProductName('怀念菜角', products)
  assert.strictEqual(p && p.name, '怀念菜饺')
})

// ---- 回归：原阿拉伯数字链路不破坏 ----
test('回归：老阿拉伯数字格式 2件 白吉馍', () => {
  const items = smart.parseOrderText('白吉馍 2件', products)
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].name, '白吉馍')
  assert.strictEqual(items[0].qty, 2)
})

console.log('\nT41 方言适配：' + passed + '/' + total + ' 通过')
process.exit(failed > 0 ? 1 : 0)
