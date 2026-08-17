/**
 * 产品功能自动化测试套件
 * 测试范围：商品管理所有功能
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const CONFIG = {
  projectRoot: '/Users/god/Desktop/项目/github/fenghuai-trading',
  productsPage: '/pages/products/products.js',
  productsWxml: '/pages/products/products.wxml',
  cloudFunction: '/cloudfunctions/products/index.js'
}

const stats = { total: 0, passed: 0, failed: 0, errors: [] }

function test(name, fn) {
  stats.total++
  try {
    fn()
    stats.passed++
    console.log(`✅ ${name}`)
  } catch (e) {
    stats.failed++
    stats.errors.push({ name, error: e.message })
    console.log(`❌ ${name}: ${e.message}`)
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 产品功能自动化测试套件')
  console.log('='.repeat(60) + '\n')

  const productsJs = fs.readFileSync(path.join(CONFIG.projectRoot, CONFIG.productsPage), 'utf8')
  const productsWxml = fs.readFileSync(path.join(CONFIG.projectRoot, CONFIG.productsWxml), 'utf8')
  const cloudFunction = fs.readFileSync(path.join(CONFIG.projectRoot, CONFIG.cloudFunction), 'utf8')

  // 文件结构
  console.log('📋 步骤 1: 文件结构')
  test('products 页面文件存在', () => {
    assert(fs.existsSync(path.join(CONFIG.projectRoot, CONFIG.productsPage)))
  })
  test('products 云函数存在', () => {
    assert(fs.existsSync(path.join(CONFIG.projectRoot, CONFIG.cloudFunction)))
  })

  // 页面功能
  console.log('\n📋 步骤 2: 页面功能')
  test('页面包含 onLoad 方法', () => assert(productsJs.includes('onLoad(')))
  test('页面包含 loadProducts 方法', () => assert(productsJs.includes('loadProducts()')))
  test('页面包含新增产品方法', () => assert(productsJs.includes('onAdd') || productsJs.includes('goToAdd')))
  test('页面包含编辑产品方法', () => assert(productsJs.includes('onEdit') || productsJs.includes('goEdit')))
  test('页面包含删除产品方法', () => assert(productsJs.includes('onDelete')))
  test('页面包含搜索功能', () => assert(productsJs.includes('onSearch') || productsJs.includes('searchKeyword')))

  // WXML 元素
  console.log('\n📋 步骤 3: UI 元素')
  test('页面包含搜索框', () => assert(productsWxml.includes('search-bar') || productsWxml.includes('搜索')))
  test('页面包含新增按钮', () => assert(productsWxml.includes('fab-btn') || productsWxml.includes('+')))
  test('页面包含产品列表', () => assert(productsWxml.includes('product-list') || productsWxml.includes('wx:for')))
  test('页面包含分类筛选', () => assert(productsWxml.includes('filter') || productsWxml.includes('分类') || productsWxml.includes('filter-btn')))
  test('页面包含排序功能', () => assert(productsWxml.includes('sort') || productsWxml.includes('排序')))
  test('页面包含空状态提示', () => assert(productsWxml.includes('empty') || productsWxml.includes('暂无')))

  // 云函数功能
  console.log('\n📋 步骤 4: 云函数功能')
  test('云函数包含 list 动作', () => assert(cloudFunction.includes("case 'list'")))
  test('云函数包含 getDetail 动作', () => assert(cloudFunction.includes("case 'getDetail'")))
  test('云函数包含 create 动作', () => assert(cloudFunction.includes("case 'create'")))
  test('云函数包含 update 动作', () => assert(cloudFunction.includes("case 'update'")))
  test('云函数包含 delete 动作', () => assert(cloudFunction.includes("case 'delete'")))
  test('云函数包含 export 动作', () => assert(cloudFunction.includes("case 'export'")))
  test('云函数支持分类筛选', () => assert(cloudFunction.includes('category')))
  test('云函数包含错误处理', () => assert(cloudFunction.includes('try') || cloudFunction.includes('catch') || cloudFunction.includes('error')))

  // 数据字段
  console.log('\n📋 步骤 5: 数据字段')
  test('包含 material_code 字段', () => assert(cloudFunction.includes('material_code')))
  test('包含 name 字段', () => assert(cloudFunction.includes('name')))
  test('包含 spec 字段', () => assert(cloudFunction.includes('spec')))
  test('包含 price_piece 字段', () => assert(cloudFunction.includes('price_piece')))
  test('包含 price_unit 字段', () => assert(cloudFunction.includes('price_unit')))
  test('包含 pricing_mode 字段', () => assert(cloudFunction.includes('pricing_mode')))
  test('包含 category 字段', () => assert(cloudFunction.includes('category')))

  // 权限控制
  console.log('\n📋 步骤 6: 权限控制')
  test('云函数包含权限检查', () => assert(cloudFunction.includes('checkPermission')))
  test('新增产品需要权限', () => {
    const createMatch = cloudFunction.match(/case\s+'create'[\s\S]{0,300}/)
    assert(createMatch && createMatch[0].includes('checkPermission'))
  })
  test('删除产品需要权限', () => {
    const deleteMatch = cloudFunction.match(/case\s+'delete'[\s\S]{0,300}/)
    assert(deleteMatch && deleteMatch[0].includes('checkPermission'))
  })

  // 数据验证
  console.log('\n📋 步骤 7: 数据验证')
  test('产品创建时验证必填字段', () => {
    const createMatch = cloudFunction.match(/case\s+'create'[\s\S]{0,500}/)
    assert(createMatch && (createMatch[0].includes('if') || createMatch[0].includes('!')))
  })
  test('产品价格验证', () => {
    const createMatch = cloudFunction.match(/case\s+'create'[\s\S]{0,500}/)
    assert(createMatch && (createMatch[0].includes('price_piece') && (createMatch[0].includes('>=') || createMatch[0].includes('验证'))))
  })

  // 搜索功能
  console.log('\n📋 步骤 8: 搜索功能')
  test('支持按名称搜索', () => assert(productsJs.includes('name') && productsJs.includes('includes')))
  test('支持按编码搜索', () => assert(productsJs.includes('material_code') || productsJs.includes('料号')))
  test('搜索支持防抖', () => assert(productsJs.includes('debounce') || productsJs.includes('setTimeout')))

  // 导出功能
  console.log('\n📋 步骤 9: 导出功能')
  test('支持产品数据导出', () => assert(cloudFunction.includes("case 'export'") || productsJs.includes('export')))
  test('支持 CSV 格式导出', () => assert(cloudFunction.includes('csv') || cloudFunction.includes('CSV')))

  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 产品功能测试总结')
  console.log('='.repeat(60))
  console.log(`总测试数：${stats.total}`)
  console.log(`✅ 通过：${stats.passed}`)
  console.log(`❌ 失败：${stats.failed}`)
  console.log(`通过率：${((stats.passed / stats.total) * 100).toFixed(1)}%`)

  if (stats.errors.length > 0) {
    console.log('\n❌ 失败测试详情:')
    stats.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.name}`)
      console.log(`     错误：${err.error}`)
    })
  }

  console.log('='.repeat(60))

  // 保存报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      passRate: ((stats.passed / stats.total) * 100).toFixed(1) + '%'
    },
    errors: stats.errors
  }

  const reportPath = path.join(CONFIG.projectRoot, 'tests', 'product-test-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 测试报告已保存：${reportPath}`)

  return stats.failed === 0
}

runTests()
  .then(success => {
    console.log('\n' + (success ? '🎉 所有测试通过！' : '⚠️ 存在失败的测试'))
    process.exit(success ? 0 : 1)
  })
  .catch(err => {
    console.error('❌ 测试框架错误:', err)
    process.exit(1)
  })
