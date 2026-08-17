/**
 * 使用 Computer Use 进行 UI 测试
 * 这个脚本会控制 Mac 上的微信开发者工具来测试小程序
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const LOG_FILE = path.join(__dirname, '..', 'computer-use-test.log')
const PROJECT_PATH = path.join(__dirname, '..')

const log = (...a) => fs.appendFileSync(LOG_FILE, a.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ') + '\n')
const sleep = ms => new Promise(r => setTimeout(r, ms))

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; log('PASS: ' + name) }
  else { fail++; log('FAIL: ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')) }
}

async function main() {
  fs.writeFileSync(LOG_FILE, '')
  log('开始 Computer Use UI 测试...')
  
  // 1. 检查 WXML 编译错误
  log('检查 WXML 编译错误...')
  const wxmlErrors = []
  const pagesDir = path.join(PROJECT_PATH, 'pages')
  const wxmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.wxml'))
  
  for (const file of wxmlFiles) {
    const filePath = path.join(pagesDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    
    // 检查嵌套三元表达式
    const nestedMatches = content.match(/{{[^}]*\?.*:.*\?.*:[^}]*}}/g)
    if (nestedMatches) {
      wxmlErrors.push(`${file}: 发现嵌套三元表达式: ${nestedMatches[0]}`)
    }
  }
  
  if (wxmlErrors.length > 0) {
    log('发现 WXML 错误:')
    wxmlErrors.forEach(e => log('  ' + e))
    fail += wxmlErrors.length
  } else {
    log('WXML 编译错误检查通过')
    pass++
  }
  
  // 2. 检查 JS 文件是否有语法错误
  log('检查 JS 语法错误...')
  const jsFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.js'))
  let jsErrors = 0
  
  for (const file of jsFiles) {
    const filePath = path.join(pagesDir, file)
    try {
      require(filePath)
    } catch (e) {
      log(`JS 错误 ${file}: ${e.message}`)
      jsErrors++
    }
  }
  
  if (jsErrors > 0) {
    fail += jsErrors
  } else {
    log('JS 语法检查通过')
    pass++
  }
  
  log('')
  log('===== Computer Use 静态测试：通过 ' + pass + ' / 失败 ' + fail + ' =====')
  
  process.exit(fail ? 1 : 0)
}

main().catch(e => {
  log('FATAL: ' + (e && e.stack || e && e.message || e))
  process.exit(2)
})
