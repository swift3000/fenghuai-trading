const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }
  return matrix[b.length][a.length]
}

function fuzzyMatch(text, candidates, threshold) {
  threshold = threshold || 0.6
  const results = []
  candidates.forEach(c => {
    const name = c.name || ''
    const dist = levenshtein(text, name)
    const maxLen = Math.max(text.length, name.length)
    const score = maxLen === 0 ? 1 : 1 - dist / maxLen
    if (score >= threshold) {
      results.push({ ...c, score })
    } else if (name.includes(text) || text.includes(name)) {
      results.push({ ...c, score: 0.7 })
    }
  })
  results.sort((a, b) => b.score - a.score)
  return results
}

function extractQuantity(text) {
  const qtyPatterns = [
    /(\d+(?:\.\d+)?)\s*件/,
    /(\d+(?:\.\d+)?)\s*箱/,
    /(\d+(?:\.\d+)?)\s*包/,
    /(\d+(?:\.\d+)?)\s*个/,
    /(\d+(?:\.\d+)?)\s*瓶/,
    /(\d+(?:\.\d+)?)\s*罐/,
    /(\d+(?:\.\d+)?)\s*袋/,
    /(\d+(?:\.\d+)?)\s*盒/,
    /(\d+(?:\.\d+)?)\s*桶/,
    /(\d+(?:\.\d+)?)\s*打/,
    /(\d+(?:\.\d+)?)\s*捆/,
    /(\d+(?:\.\d+)?)\s*包/,
    /(\d+(?:\.\d+)?)\s*包/,
    /(\d+(?:\.\d+)?)\s*箱/,
    /(\d+(?:\.\d+)?)\s*条/,
    /(\d+(?:\.\d+)?)\s*包/,
    /(\d+(?:\.\d+)?)\s*包/
  ]
  
  for (const pattern of qtyPatterns) {
    const match = text.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }
  
  const simpleQty = text.match(/(\d+(?:\.\d+)?)/)
  if (simpleQty) {
    return parseFloat(simpleQty[1])
  }
  
  return 1
}

function extractProductName(text, products) {
  const commonWords = ['给', '发', '要', '买', '订', '货', '的', '了', '个', '件', '箱', '包', '瓶', '罐', '袋', '盒', '桶', '打', '捆', '条']
  let cleanText = text
  for (const word of commonWords) {
    cleanText = cleanText.replace(word, ' ')
  }
  cleanText = cleanText.replace(/\d+(?:\.\d+)?/g, ' ')
  cleanText = cleanText.replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
  cleanText = cleanText.trim()
  
  const words = cleanText.split(/\s+/).filter(w => w.length > 1)
  
  for (const word of words) {
    const matches = fuzzyMatch(word, products, 0.7)
    if (matches.length > 0 && matches[0].score >= 0.7) {
      return matches[0]
    }
  }
  
  for (const product of products) {
    if (cleanText.includes(product.name)) {
      return product
    }
  }
  
  const allMatches = fuzzyMatch(cleanText, products, 0.6)
  if (allMatches.length > 0) {
    return allMatches[0]
  }
  
  return null
}

function parseOrderText(text, products) {
  const items = []
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(件 | 箱 | 包 | 个 | 瓶 | 罐 | 袋 | 盒 | 桶 | 打 | 捆 | 条)(.+?)(?=\d+(?:\.\d+)?\s*(件 | 箱 | 包 | 个 | 瓶 | 罐 | 袋 | 盒 | 桶 | 打 | 捆 | 条)|$)/g,
    /(.+?)(\d+(?:\.\d+)?)\s*(件 | 箱 | 包 | 个 | 瓶 | 罐 | 袋 | 盒 | 桶 | 打 | 捆 | 条)(.+?)(?=\d+(?:\.\d+)?\s*(件 | 箱 | 包 | 个 | 瓶 | 罐 | 袋 | 盒 | 桶 | 打 | 捆 | 条)|$)/g
  ]
  
  let match
  const regex = /(\d+(?:\.\d+)?)\s*(件 | 箱 | 包 | 个 | 瓶 | 罐 | 袋 | 盒 | 桶 | 打 | 捆 | 条)([^件箱包包个瓶罐袋盒桶打捆条]+)/g
  while ((match = regex.exec(text)) !== null) {
    const qty = parseFloat(match[1])
    const unit = match[2]
    const productName = match[3].trim()
    
    let product = null
    for (const p of products) {
      if (productName.includes(p.name) || p.name.includes(productName)) {
        product = p
        break
      }
    }
    
    if (!product) {
      const matches = fuzzyMatch(productName, products, 0.65)
      if (matches.length > 0) {
        product = matches[0]
      }
    }
    
    if (product) {
      items.push({
        _id: product._id,
        name: product.name,
        spec: product.spec || '',
        price: product.pricePiece || 0,
        qty: qty
      })
    }
  }
  
  if (items.length === 0) {
    const words = text.split(/[\s，,、]+/).filter(w => w.length > 1)
    for (const word of words) {
      if (word.match(/\d/)) continue
      const product = extractProductName(word, products)
      if (product) {
        const qty = extractQuantity(text)
        items.push({
          _id: product._id,
          name: product.name,
          spec: product.spec || '',
          price: product.pricePiece || 0,
          qty: qty
        })
        break
      }
    }
  }
  
  return items
}


// 权限校验
async function checkPermission(permission) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    console.log('⚠️ 后台调用，跳过权限校验')
    return { code: 0 }
  }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
  if (user.role === 'admin') return { code: 0 }
  if (user.permissions && user.permissions.includes(permission)) return { code: 0 }
  return { code: 403, message: '无权限访问' }
}

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'match': {
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const { text } = event
      if (!text) return { code: 5001, message: 'text 参数为空' }
      const products = await db.collection('products').get()
      const customers = await db.collection('customers').get()
      const productResults = fuzzyMatch(text, products.data, 0.6)
      const customerResults = fuzzyMatch(text, customers.data, 0.6)
      return { code: 0, data: { products: productResults, customers: customerResults } }
    }
    
    case 'transcribe': {
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      return { code: 0, data: { text: event.audioText || '' } }
    }
    
    case 'parse': {
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const { text } = event
      if (!text) return { code: 5002, message: 'text 参数为空' }
      
      const productsResult = await db.collection('products').where({ status: 1 }).get()
      const products = productsResult.data
      
      if (products.length === 0) {
        return { code: 5003, message: '暂无商品数据' }
      }
      
      const items = parseOrderText(text, products)
      
      return { code: 0, data: { items } }
    }
    
    default:
      return { code: 1001, message: '未知 action' }
  }
}
