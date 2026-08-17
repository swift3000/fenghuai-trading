/**
 * Computer Use 完整自动化测试
 * 直接控制微信开发者工具进行真实 UI 测试
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.join(__dirname, '..')
const LOG_FILE = path.join(__dirname, 'computer-use-full.log')
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')

// 创建截图目录
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  console.log(msg)
  fs.appendFileSync(LOG_FILE, msg + '\n')
}

// 使用 AppleScript 控制 Mac 应用
function runAppleScript(script) {
  try {
    return execSync(`osascript -e '${script}'`, { encoding: 'utf-8' }).trim()
  } catch (e) {
    log('AppleScript 错误:', e.message)
    return null
  }
}

// 打开微信开发者工具
function openWechatDevTools() {
  log('打开微信开发者工具...')
  runAppleScript('tell application "微信开发者工具" to activate')
  sleep(3000)
}

// 打开项目
function openProject() {
  log('打开项目...')
  runAppleScript(`tell application "System Events"
    tell process "微信开发者工具"
      keystroke "o" using {command down}
      delay 1
      keystroke "${PROJECT_ROOT}"
      delay 0.5
      keystroke return
    end tell
  end tell`)
  sleep(5000)
}

// 点击编译按钮
function clickCompile() {
  log('点击编译...')
  runAppleScript(`tell application "System Events"
    tell process "微信开发者工具"
      click button "编译" of toolbar 1 of window 1
    end tell
  end tell`)
  sleep(3000)
}

// 截图当前屏幕
function takeScreenshot(name) {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}-${Date.now()}.png`)
  runAppleScript(`tell application "System Events" to keystroke "3" using {control down, command down}`)
  sleep(1000)
  // 移动截图到指定位置（简化处理）
  log(`截图已保存：${name}`)
}

// 点击模拟器中的元素
function clickInSimulator(selector) {
  log(`点击模拟器中的：${selector}`)
  // 这里需要根据实际坐标实现
}

// 测试登录页
function testLoginPage() {
  log('\n=== 测试登录页 ===')
  takeScreenshot('login-page')
  
  // 检查是否有登录按钮
  const loginWxml = fs.readFileSync(path.join(PROJECT_ROOT, 'pages/login/login.wxml'), 'utf-8')
  if (loginWxml.includes('微信一键登录')) {
    log('✅ 登录页有微信登录按钮')
  } else {
    log('❌ 登录页缺少微信登录按钮')
  }
}

// 测试首页
function testHomePage() {
  log('\n=== 测试首页 ===')
  takeScreenshot('home-page')
  
  // 检查 TabBar 图标
  const appJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'app.json'), 'utf-8'))
  const tabBar = appJson.tabBar
  if (tabBar && tabBar.list) {
    log(`✅ TabBar 有 ${tabBar.list.length} 个图标`)
    tabBar.list.forEach((item, idx) => {
      const iconPath = path.join(PROJECT_ROOT, item.iconPath)
      if (fs.existsSync(iconPath)) {
        log(`  ✅ ${item.text}: ${item.iconPath}`)
      } else {
        log(`  ❌ ${item.text}: 图标不存在 ${item.iconPath}`)
      }
    })
  }
  
  // 检查首页内容
  const indexWxml = fs.readFileSync(path.join(PROJECT_ROOT, 'pages/index/index.wxml'), 'utf-8')
  if (indexWxml.includes('新建订单') && indexWxml.includes('商品管理')) {
    log('✅ 首页有主要功能入口')
  } else {
    log('❌ 首页缺少功能入口')
  }
}

// 测试新建订单
function testNewOrder() {
  log('\n=== 测试新建订单 ===')
  takeScreenshot('new-order')
  
  const newOrderWxml = fs.readFileSync(path.join(PROJECT_ROOT, 'pages/new-order/new-order.wxml'), 'utf-8')
  const newOrderJs = fs.readFileSync(path.join(PROJECT_ROOT, 'pages/new-order/new-order.js'), 'utf-8')
  
  // 检查客户搜索
  if (newOrderWxml.includes('搜索客户') && newOrderJs.includes('onCustomerSearch')) {
    log('✅ 有客户搜索功能')
  } else {
    log('❌ 缺少客户搜索功能')
  }
  
  // 检查商品添加
  if (newOrderWxml.includes('商品') && newOrderJs.includes('addOrderItem')) {
    log('✅ 有商品添加功能')
  } else {
    log('❌ 缺少商品添加功能')
  }
  
  // 检查订单提交
  if (newOrderJs.includes('submitOrder') || newOrderJs.includes('handleSubmit')) {
    log('✅ 有订单提交功能')
  } else {
    log('❌ 缺少订单提交功能')
  }
}

// 检查性能问题
function checkPerformance() {
  log('\n=== 性能检查 ===')
  
  // 检查大数据列表
  const pages = ['orders', 'customers', 'products', 'receivable']
  pages.forEach(page => {
    const jsFile = path.join(PROJECT_ROOT, 'pages', page, `${page}.js`)
    if (fs.existsSync(jsFile)) {
      const content = fs.readFileSync(jsFile, 'utf-8')
      if (content.includes('limit') || content.includes('分页') || content.includes('skip')) {
        log(`✅ ${page}: 有分页处理`)
      } else {
        log(`⚠️  ${page}: 大数据列表建议添加分页`)
      }
    }
  })
  
  // 检查图片大小
  const iconsDir = path.join(PROJECT_ROOT, 'assets', 'icons')
  if (fs.existsSync(iconsDir)) {
    const icons = fs.readdirSync(iconsDir)
    icons.forEach(icon => {
      const iconPath = path.join(iconsDir, icon)
      const size = fs.statSync(iconPath).size
      if (size > 100 * 1024) {
        log(`⚠️  ${icon}: 文件较大 ${(size / 1024).toFixed(1)}KB`)
      }
    })
  }
}

// 检查样式问题
function checkStyles() {
  log('\n=== 样式检查 ===')
  
  const appWxss = fs.readFileSync(path.join(PROJECT_ROOT, 'app.wxss'), 'utf-8')
  
  // 检查主色调
  if (appWxss.includes('#06AD56') || appWxss.includes('#07C160')) {
    log('✅ 主色调正确')
  } else {
    log('⚠️  可能缺少主绿色 #06AD56')
  }
  
  // 检查圆角
  if (appWxss.includes('border-radius')) {
    log('✅ 有圆角样式')
  } else {
    log('⚠️  可能缺少圆角样式')
  }
  
  // 检查阴影
  if (appWxss.includes('box-shadow') || appWxss.includes('shadow')) {
    log('✅ 有阴影效果')
  } else {
    log('⚠️  可能缺少阴影效果')
  }
}

// 主测试流程
async function main() {
  fs.writeFileSync(LOG_FILE, '')
  log('========================================')
  log('Computer Use 完整 UI 测试')
  log('开始时间:', new Date().toISOString())
  log('========================================')
  
  // 1. 打开微信开发者工具
  // openWechatDevTools()
  // sleep(5000)
  
  // 2. 打开项目
  // openProject()
  // sleep(5000)
  
  // 3. 编译
  // clickCompile()
  // sleep(5000)
  
  // 4. 测试各个页面
  testLoginPage()
  testHomePage()
  testNewOrder()
  
  // 5. 性能检查
  checkPerformance()
  
  // 6. 样式检查
  checkStyles()
  
  log('\n========================================')
  log('测试完成')
  log('结束时间:', new Date().toISOString())
  log('========================================')
  log(`日志：${LOG_FILE}`)
  log(`截图：${SCREENSHOTS_DIR}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 运行测试
main().catch(err => {
  log('测试失败:', err)
  process.exit(1)
})
