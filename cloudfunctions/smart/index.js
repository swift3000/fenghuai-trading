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

exports.main = async (event, context) => {
  const { action } = event
  switch (action) {
    case 'match': {
      const { text } = event
      if (!text) return { code: 5001, message: 'text 参数为空' }
      const products = await db.collection('products').get()
      const customers = await db.collection('customers').get()
      const productResults = fuzzyMatch(text, products.data, 0.6)
      const customerResults = fuzzyMatch(text, customers.data, 0.6)
      return { code: 0, data: { products: productResults, customers: customerResults } }
    }
    case 'transcribe': {
      return { code: 0, data: { text: event.audioText || '' } }
    }
    default:
      return { code: 1001, message: '未知 action' }
  }
}
