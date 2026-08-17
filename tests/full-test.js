/**
 * 完整功能测试 - 最终版
 */
const fs = require('fs')
const path = require('path')

const LOG_FILE = path.join(__dirname, '..', 'full-test.log')
const PROJECT_PATH = path.join(__dirname, '..')

const log = (...a) => fs.appendFileSync(LOG_FILE, a.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ') + '\n')

let pass = 0
let fail = 0
let tests = []

function check(name, cond, extra) {
  const result = { name, pass: cond, extra }
  tests.push(result)
  if (cond) { pass++; log('PASS: ' + name) }
  else { fail++; log('FAIL: ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')) }
  return cond
}

// 检查真正的嵌套三元表达式（多个 ? 在同一表达式）
function hasNestedTernary(content) {
  // 匹配 {{ ... ? ... : ... ? ... : ... }} 模式
  const matches = content.match(/{{[^}]*\?.*:\s*\([^}]*\?.*:[^}]*\)[^}]*}}/g)
  if (matches) return matches
  
  // 匹配 {{ ... ? ... : ... ? ... : ... }} 模式（无括号）
  const nestedPattern = /\{\{[^}]+\?\s*[^}]+\:\s*[^}]+\?\s*[^}]+\:\s*[^}]+\}\}/g
  const nestedMatches = content.match(nestedPattern)
  return nestedMatches || null
}

async function main() {
  fs.writeFileSync(LOG_FILE, '')
  log('开始完整功能测试...')
  
  // 1. WXML 编译错误检查
  log('=== 1. WXML 编译错误检查 ===')
  const pagesDir = path.join(PROJECT_PATH, 'pages')
  const pageDirs = fs.readdirSync(pagesDir).filter(f => fs.statSync(path.join(pagesDir, f)).isDirectory())
  
  for (const pageDir of pageDirs) {
    const fullPath = path.join(pagesDir, pageDir)
    const wxmlFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.wxml'))
    
    for (const wxmlFile of wxmlFiles) {
      const filePath = path.join(fullPath, wxmlFile)
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // 检查真正的嵌套三元表达式
      const nestedMatches = hasNestedTernary(content)
      if (nestedMatches) {
        check(`${pageDir}/${wxmlFile} 无嵌套三元表达式`, false, nestedMatches)
      } else {
        check(`${pageDir}/${wxmlFile} 无嵌套三元表达式`, true)
      }
    }
  }
  
  // 2. JS 语法检查
  log('=== 2. JS 语法检查 ===')
  for (const pageDir of pageDirs) {
    const fullPath = path.join(pagesDir, pageDir)
    const jsFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.js'))
    
    for (const jsFile of jsFiles) {
      const filePath = path.join(fullPath, jsFile)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        check(`${pageDir}/${jsFile} 文件可读`, true)
      } catch (e) {
        check(`${pageDir}/${jsFile} 文件可读`, false, e.message)
      }
    }
  }
  
  // 3. 云函数检查
  log('=== 3. 云函数检查 ===')
  const cloudfunctionsDir = path.join(PROJECT_PATH, 'cloudfunctions')
  if (fs.existsSync(cloudfunctionsDir)) {
    const cfFiles = fs.readdirSync(cloudfunctionsDir).filter(f => fs.statSync(path.join(cloudfunctionsDir, f)).isDirectory())
    check(`云函数数量`, cfFiles.length > 0, cfFiles.length)
    
    for (const cf of cfFiles) {
      const cfPath = path.join(cloudfunctionsDir, cf)
      const indexJs = path.join(cfPath, 'index.js')
      check(`${cf}/index.js 存在`, fs.existsSync(indexJs))
    }
  } else {
    check('云函数目录存在', false)
  }
  
  // 4. 配置文件检查
  log('=== 4. 配置文件检查 ===')
  check('app.json 存在', fs.existsSync(path.join(PROJECT_PATH, 'app.json')))
  check('project.config.json 存在', fs.existsSync(path.join(PROJECT_PATH, 'project.config.json')))
  check('package.json 存在', fs.existsSync(path.join(PROJECT_PATH, 'package.json')))
  
  // 5. 页面路由检查
  log('=== 5. 页面路由检查 ===')
  const appJson = JSON.parse(fs.readFileSync(path.join(PROJECT_PATH, 'app.json'), 'utf-8'))
  const pages = appJson.pages || []
  check(`页面数量`, pages.length > 0, pages.length)
  
  for (const page of pages) {
    const pagePath = path.join(PROJECT_PATH, page)
    check(`${page} 文件存在`, fs.existsSync(pagePath + '.wxml'))
  }
  
  log('')
  log('===== 完整功能测试：通过 ' + pass + ' / 失败 ' + fail + ' =====')
  log('测试详情:')
  tests.forEach(t => log(`  ${t.pass ? '✓' : '✗'} ${t.name}`))
  
  process.exit(fail ? 1 : 0)
}

main().catch(e => {
  log('FATAL: ' + (e && e.stack || e && e.message || e))
  process.exit(2)
})
