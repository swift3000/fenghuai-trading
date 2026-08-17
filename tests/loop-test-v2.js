/**
 * Loop 工作流 - 完整测试和修复（v2）
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PROJECT_ROOT = path.join(__dirname, '..')
const LOG_FILE = path.join(__dirname, 'reports/loop-test.log')

const log = (...args) => {
  const msg = args.map(a => String(a)).join(' ')
  console.log(msg)
  fs.appendFileSync(LOG_FILE, msg + '\n')
}

let issues = []
let fixed = []

function checkWXML() {
  log('\n=== 检查 WXML 文件 ===')
  const pagesDir = path.join(PROJECT_ROOT, 'pages')
  
  function walk(dir) {
    const files = fs.readdirSync(dir)
    files.forEach(file => {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        walk(fullPath)
      } else if (file.endsWith('.wxml')) {
        checkWXMLFile(fullPath)
      }
    })
  }
  
  function checkWXMLFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const relPath = path.relative(PROJECT_ROOT, filePath)
    
    // 检查重复的 wx:key
    const dupKeyMatches = content.match(/wx:key="[^"]*"\s+wx:key="[^"]*"/g)
    if (dupKeyMatches) {
      issues.push({ file: relPath, type: '重复 wx:key', detail: dupKeyMatches })
      log(`❌ ${relPath}: 发现 ${dupKeyMatches.length} 处重复 wx:key`)
    }
    
    // 检查 wx:for 没有 wx:key
    const forMatches = content.match(/wx:for="[^"]*"/g) || []
    const keyMatches = content.match(/wx:key="[^"]*"/g) || []
    if (forMatches.length > keyMatches.length) {
      issues.push({ 
        file: relPath, 
        type: '缺少 wx:key', 
        detail: `${forMatches.length}个 wx:for, ${keyMatches.length}个 wx:key` 
      })
      log(`⚠️  ${relPath}: ${forMatches.length}个 wx:for, ${keyMatches.length}个 wx:key`)
    }
  }
  
  walk(pagesDir)
}

function fixIssues() {
  if (issues.length === 0) return
  
  log('\n=== 自动修复问题 ===')
  
  // 修复重复的 wx:key
  const pagesDir = path.join(PROJECT_ROOT, 'pages')
  function walk(dir) {
    const files = fs.readdirSync(dir)
    files.forEach(file => {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        walk(fullPath)
      } else if (file.endsWith('.wxml')) {
        fixWXMLFile(fullPath)
      }
    })
  }
  
  function fixWXMLFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content
    
    // 修复重复的 wx:key
    content = content.replace(/(wx:key="[^"]*")\s+wx:key="[^"]*"/g, '$1')
    
    if (content !== original) {
      fs.writeFileSync(filePath, content)
      const relPath = path.relative(PROJECT_ROOT, filePath)
      fixed.push(relPath)
      log(`✅ 修复：${relPath}`)
    }
  }
  
  walk(pagesDir)
}

function checkCloudFunctions() {
  log('\n=== 检查云函数 ===')
  const cfDir = path.join(PROJECT_ROOT, 'cloudfunctions')
  
  if (!fs.existsSync(cfDir)) {
    log('❌ cloudfunctions 目录不存在')
    return
  }
  
  const cfs = fs.readdirSync(cfDir).filter(f => {
    const stat = fs.statSync(path.join(cfDir, f))
    return stat.isDirectory() && !f.startsWith('.')
  })
  
  log(`找到 ${cfs.length} 个云函数`)
  
  cfs.forEach(cf => {
    const cfPath = path.join(cfDir, cf)
    const hasIndex = fs.existsSync(path.join(cfPath, 'index.js'))
    const hasConfig = fs.existsSync(path.join(cfPath, 'config.json'))
    const hasPackage = fs.existsSync(path.join(cfPath, 'package.json'))
    
    if (hasIndex && hasConfig && hasPackage) {
      log(`✅ ${cf}: 配置完整`)
    } else {
      log(`❌ ${cf}: 缺少 ${!hasIndex ? 'index.js ' : ''}${!hasConfig ? 'config.json ' : ''}${!hasPackage ? 'package.json' : ''}`)
      issues.push({ file: `cloudfunctions/${cf}`, type: '配置缺失' })
    }
  })
}

function checkAssets() {
  log('\n=== 检查资源文件 ===')
  const iconsDir = path.join(PROJECT_ROOT, 'assets', 'icons')
  
  if (!fs.existsSync(iconsDir)) {
    log('❌ assets/icons 目录不存在')
    return
  }
  
  const requiredIcons = [
    'home.png', 'home-active.png',
    'order.png', 'order-active.png',
    'money.png', 'money-active.png',
    'outbound.png', 'outbound-active.png',
    'profile.png', 'profile-active.png'
  ]
  
  requiredIcons.forEach(icon => {
    const iconPath = path.join(iconsDir, icon)
    if (fs.existsSync(iconPath)) {
      const size = fs.statSync(iconPath).size
      if (size < 200 * 1024) {
        log(`✅ ${icon}: ${(size / 1024).toFixed(1)}KB`)
      } else {
        log(`⚠️  ${icon}: 文件过大 ${(size / 1024).toFixed(1)}KB`)
      }
    } else {
      log(`❌ ${icon}: 不存在`)
      issues.push({ file: `assets/icons/${icon}`, type: '缺失' })
    }
  })
}

function main() {
  fs.writeFileSync(LOG_FILE, '')
  log('========================================')
  log('Loop 测试 v2 开始')
  log('时间:', new Date().toISOString())
  log('========================================')
  
  let round = 0
  const maxRounds = 5
  
  while (round < maxRounds) {
    round++
    issues = []
    
    log(`\n========== 第 ${round} 轮 ==========`)
    
    checkWXML()
    checkCloudFunctions()
    checkAssets()
    
    if (issues.length === 0) {
      log('\n✅ 所有检查通过！')
      break
    }
    
    log(`\n发现 ${issues.length} 个问题`)
    
    if (round < maxRounds) {
      fixIssues()
    }
  }
  
  log('\n========================================')
  log('Loop 测试完成')
  log(`总轮数：${round}`)
  log(`剩余问题：${issues.length}`)
  log(`已修复：${fixed.length}`)
  log('========================================')
  
  // 生成报告
  const report = `# Loop 测试报告

**完成轮数**: ${round}
**剩余问题**: ${issues.length}
**已修复**: ${fixed.length}

## 修复的文件
${fixed.map(f => `- ${f}`).join('\n')}

## 剩余问题
${issues.length === 0 ? '无' : issues.map(i => `- ${i.file}: ${i.type}`).join('\n')}
`
  
  fs.writeFileSync(path.join(__dirname, 'reports/LOOP-TEST-V2.md'), report)
  log('\n📄 报告已保存到：reports/LOOP-TEST-V2.md')
}

main()
