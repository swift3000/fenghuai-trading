/**
 * 快速修复脚本 - 修复所有已知问题
 */

const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.join(__dirname, '..')

console.log('🔧 开始快速修复...\n')

let fixed = 0

// 1. 修复所有 WXML 中的重复 wx:key
console.log('1. 修复重复 wx:key...')
function fixWXML(dir) {
  const files = fs.readdirSync(dir)
  files.forEach(file => {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory() && !file.startsWith('.')) {
      fixWXML(fullPath)
    } else if (file.endsWith('.wxml')) {
      let content = fs.readFileSync(fullPath, 'utf-8')
      const original = content
      
      // 修复重复的 wx:key
      content = content.replace(/(wx:key="[^"]*")\s+wx:key="[^"]*"/g, '$1')
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content)
        console.log(`   ✅ ${path.relative(PROJECT_ROOT, fullPath)}`)
        fixed++
      }
    }
  })
}

fixWXML(path.join(PROJECT_ROOT, 'pages'))

// 2. 确保所有云函数有 package.json
console.log('\n2. 检查云函数 package.json...')
const cfDir = path.join(PROJECT_ROOT, 'cloudfunctions')
const cfs = fs.readdirSync(cfDir).filter(f => {
  const stat = fs.statSync(path.join(cfDir, f))
  return stat.isDirectory() && !f.startsWith('.')
})

cfs.forEach(cf => {
  const pkgPath = path.join(cfDir, cf, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: cf,
      version: '1.0.0',
      description: `${cf} cloud function`,
      main: 'index.js',
      dependencies: {}
    }, null, 2))
    console.log(`   ✅ 创建 ${cf}/package.json`)
    fixed++
  }
})

// 3. 优化首页数据加载（添加错误处理）
console.log('\n3. 优化数据加载...')
const indexJs = path.join(PROJECT_ROOT, 'pages/index/index.js')
if (fs.existsSync(indexJs)) {
  let content = fs.readFileSync(indexJs, 'utf-8')
  
  // 确保有错误处理
  if (!content.includes('catch')) {
    content = content.replace(
      /wx\.cloud\.callFunction\(/g,
      'wx.cloud.callFunction({\n      success: res => {\n        console.log(\'调用成功\', res)\n      },\n      fail: err => {\n        console.error(\'调用失败\', err)\n      }\n    )'
    )
    fs.writeFileSync(indexJs, content)
    console.log('   ✅ 添加错误处理')
    fixed++
  }
}

console.log(`\n✅ 修复完成！共修复 ${fixed} 个问题`)
console.log('\n下一步：')
console.log('1. 在微信开发者工具中点击"编译"')
console.log('2. 查看 Console 是否还有错误')
console.log('3. 如有错误，截图发给我')
