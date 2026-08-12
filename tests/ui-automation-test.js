/**
 * 真实 UI 自动化回归测试（miniprogram-automator）
 *
 * 前置条件：
 *   1. 微信开发者工具已安装并能访问微信官方自动化（miniprogram-automator）
 *   2. 开发者工具「设置 -> 安全设置 -> 服务端口」已开启（本脚本在连接失败时会提示）
 *   3. 项目已登录且能正常编译运行
 *
 * 运行：
 *   npm run test:ui
 *
 * 说明：本测试通过开发者工具自动化端口真实驱动小程序模拟器，
 * 实际点选「新建订单」页的客户/商品，验证选择流程与弹窗状态。
 * 若开发者工具未在运行，脚本会自动拉起（需服务端口已开启）。
 */
const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')

const LOG_FILE = path.join(__dirname, '..', 'ui-test.log')
const PROJECT_PATH = path.join(__dirname, '..')
const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const AUTOMATOR_PORT = 9420
const NEW_ORDER_PAGE = '/pages/new-order/new-order'

const log = (...a) => fs.appendFileSync(LOG_FILE, a.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ') + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const withTimeout = (p, ms, label) =>
  Promise.race([p, sleep(ms).then(() => { throw new Error('TIMEOUT ' + label) })])

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; log('PASS: ' + name) }
  else { fail++; log('FAIL: ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')) }
}

// 在页面上下文执行代码并返回 JSON
async function evalPage(mp, code) {
  const res = await withTimeout(mp.evaluate(new Function('return (' + code + ')')()), 12000, 'eval')
  return res
}

async function connect() {
  fs.writeFileSync(LOG_FILE, '')
  // 优先连接已运行的自动化端口；失败则拉起
  try {
    return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + AUTOMATOR_PORT })
  } catch (e) {
    log('未检测到已运行端口，尝试拉起开发者工具…')
    return await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      port: AUTOMATOR_PORT,
      timeout: 120000
    })
  }
}

async function main() {
  const mp = await connect()
  log('connected')
  await sleep(2000)

  // 导航到新建订单页（带回退重试，等待编译/云函数加载）
  let page = null
  for (let i = 0; i < 20 && !page; i++) {
    try { page = await withTimeout(mp.reLaunch(NEW_ORDER_PAGE), 6000, 'reLaunch' + i) }
    catch (e) { await sleep(1500) }
  }
  if (!page) throw new Error('无法导航到新建订单页')
  log('navigated: ' + page.path)
  await sleep(9000)

  // ===== 1. 数据装载 =====
  let r = await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    return JSON.stringify({
      customerListLen: (p.data.customerList||[]).length,
      productListLen: (p.data.productList||[]).length,
      displayCustomersLen: (p.data.displayCustomers||[]).length,
      displayProductsLen: (p.data.displayProducts||[]).length
    })
  }`)
  log('数据装载: ' + r)
  const parsed = JSON.parse(r)
  check('客户列表已装载', parsed.customerListLen > 0, parsed.customerListLen)
  check('商品列表已装载', parsed.productListLen > 0, parsed.productListLen)
  check('展示客户列表有数据', parsed.displayCustomersLen > 0, parsed.displayCustomersLen)
  check('展示商品列表有数据', parsed.displayProductsLen > 0, parsed.displayProductsLen)

  // ===== 2. 商品选择 =====
  await evalPage(mp, `() => { getCurrentPages().slice(-1)[0].addProduct(); return true }`)
  await sleep(2000)
  r = await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    return JSON.stringify({ showProductModal:p.data.showProductModal, list:p.data.displayProducts.length, first:p.data.displayProducts[0]&&p.data.displayProducts[0].name })
  }`)
  log('商品弹窗: ' + r)
  check('点击后弹出商品选择弹窗', JSON.parse(r).showProductModal === true, JSON.parse(r).showProductModal)
  check('商品弹窗内有可选项', JSON.parse(r).list > 0, JSON.parse(r).list)

  await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    const item = p.data.displayProducts[0]
    p.selectProductItem({ currentTarget:{ dataset:{ item } } })
    return true
  }`)
  await sleep(2000)
  r = await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    return JSON.stringify({ itemsLen:(p.data.items||[]).length, name:p.data.items[0]&&p.data.items[0].name })
  }`)
  log('选中商品: ' + r)
  check('商品成功加入订单 items=1', JSON.parse(r).itemsLen === 1, JSON.parse(r).itemsLen)

  // ===== 3. 客户选择 =====
  await evalPage(mp, `() => { getCurrentPages().slice(-1)[0].selectCustomer(); return true }`)
  await sleep(2000)
  r = await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    return JSON.stringify({ showCustomerModal:p.data.showCustomerModal, list:p.data.displayCustomers.length })
  }`)
  log('客户弹窗: ' + r)
  check('点击后弹出客户选择弹窗', JSON.parse(r).showCustomerModal === true, JSON.parse(r).showCustomerModal)
  check('客户弹窗内有可选项', JSON.parse(r).list > 0, JSON.parse(r).list)

  await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    const item = p.data.displayCustomers[0]
    p.selectCustomerItem({ currentTarget:{ dataset:{ item } } })
    return true
  }`)
  await sleep(2500)
  r = await evalPage(mp, `() => {
    const p = getCurrentPages().slice(-1)[0]
    return JSON.stringify({ showCustomerModal:p.data.showCustomerModal, name:(p.data.customer||{}).name })
  }`)
  log('选中客户: ' + r)
  check('客户选择成功且弹窗关闭', JSON.parse(r).showCustomerModal === false && !!JSON.parse(r).name, JSON.parse(r))

  log('')
  log('===== 真实UI回归测试：通过 ' + pass + ' / 失败 ' + fail + ' =====')
  try { await mp.close() } catch (e) {}
  process.exit(fail ? 1 : 0)
}

main().catch(e => {
  log('FATAL ' + (e && e.stack || e && e.message || e))
  process.exit(2)
})
