const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// QA 身份模拟钩子（仅当云函数环境变量 QA_IMPERSONATE='1' 且请求携带 event.qaAsOpenid 时生效，生产不设置→惰性）
let __impersonatedOpenid = null
const https = require('https')
const crypto = require('crypto')

// ============ 腾讯云 ASR（录音文件识别，音频走现有 CloudBase 存储临时链接） ============
const ASR_HOST = 'asr.tencentcloudapi.com'
const ASR_SERVICE = 'asr'
const ASR_VERSION = '2019-06-14'

function sha256hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}
function hmacsha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

// TC3-HMAC-SHA256 签名 + POST 调用腾讯云 API
function tencentApiCall({ secretId, secretKey, action, payload }) {
  return new Promise((resolve, reject) => {
    const date = new Date().toISOString().slice(0, 10)
    const timestamp = Math.floor(Date.now() / 1000)
    const body = JSON.stringify(payload)

    const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:' + ASR_HOST + '\nx-tc-action:' + action.toLowerCase() + '\n'
    const signedHeaders = 'content-type;host;x-tc-action'
    const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256hex(body)].join('\n')
    const credentialScope = date + '/' + ASR_SERVICE + '/tc3_request'
    const stringToSign = 'TC3-HMAC-SHA256\n' + timestamp + '\n' + credentialScope + '\n' + sha256hex(canonicalRequest)
    const kDate = hmacsha256('TC3' + secretKey, date)
    const kService = hmacsha256(kDate, ASR_SERVICE)
    const kSigning = hmacsha256(kService, 'tc3_request')
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
    const authorization = 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature

    const req = https.request({
      hostname: ASR_HOST,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': ASR_HOST,
        'X-TC-Action': action,
        'X-TC-Version': ASR_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          // 腾讯云 v3 返回 {Response:{Error?}|{Data?...}}
          if (j.Response && j.Response.Error) {
            return reject(new Error(j.Response.Error.Message || (j.Response.Error.Code || 'ASR API错误')))
          }
          resolve((j.Response && j.Response.Data) || (j.Response && j.Response.TaskId !== undefined ? j.Response : {}) || {})
        } catch (e) {
          reject(new Error('ASR 响应解析失败: ' + data.slice(0, 120)))
        }
      })
    })
    req.on('error', e => reject(new Error('ASR 请求失败: ' + e.message)))
    req.setTimeout(30000, () => { req.destroy(new Error('ASR 请求超时')) })
    req.write(body)
    req.end()
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ============ TokenHub 大模型（NLP 复杂语义理解，OpenAI 兼容接口，密钥 ai.tokenhub，与 ASR 分离） ============

// 清洗 ASR 返回文本：去掉 [0:0.000,0:4.655] 等时间戳/区间标记、换行与首尾空白
function cleanAsrText(t) {
  if (!t) return ''
  return String(t)
    .replace(/\[[^\]]*:[^\]]*\]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 录音文件识别：提交任务 → 轮询取结果（最多等 30 秒）
async function asrTranscribe(tc, audioUrl) {
  // 录音文件识别 CreateRecTask：EngineModelType/ChannelNum/ResTextFormat/SourceType 为必填，无 ProjectId/VoiceFormat
  const submit = await tencentApiCall({
    secretId: tc.secretId, secretKey: tc.secretKey,
    action: 'CreateRecTask',
    payload: {
      EngineModelType: tc.engine === '8k_zh' ? '8k_zh' : '16k_zh',
      ChannelNum: 1,      // 单声道
      ResTextFormat: 0,   // 全文返回（含标点）
      SourceType: 0,      // 普通录音（非电话）
      Url: audioUrl
    }
  })
  if (!submit || submit.TaskId === undefined || submit.TaskId === null) {
    throw new Error('提交识别任务失败：未返回 TaskId')
  }
  // 轮询 DescribeTaskStatus（最多 60s）：部分任务 Result 先于 Status=0 返回，故以 Result 有内容为准
  for (let i = 0; i < 28; i++) {
    await sleep(2000)
    const st = await tencentApiCall({
      secretId: tc.secretId, secretKey: tc.secretKey,
      action: 'DescribeTaskStatus',
      payload: { TaskId: submit.TaskId }
    })
    // 结果文本（Result 为全文；ResultDetail 为分句），去掉 [0:0.000,0:4.655] 时间戳标记
    const raw = st.Result || (st.ResultDetail && st.ResultDetail.length ? st.ResultDetail.map(d => d.TextShow || d.Result || '').join('') : '')
    const txt = cleanAsrText(raw)
    if (st.Status === 0) {
      return txt || ''
    }
    if (txt) {
      return txt // 识别已完成、状态位未跳 0 的常见情形，直接取已生成的全文
    }
    if (st.Status === -1 || st.Status === -2) {
      throw new Error('识别失败：' + (st.ErrorMsg || 'Status=' + st.Status))
    }
    // Status 2/3 继续等待
  }
  throw new Error('识别超时，请稍后重试')
}


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
        price: product.price_piece || 0,
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
          price: product.price_piece || 0,
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
  const { OPENID: __rawOID } = cloud.getWXContext()
  const OPENID = __impersonatedOpenid || __rawOID
  if (!OPENID) { return { code: 401, message: '无法获取用户身份，请在小程序内访问' } }
  const userResult = await db.collection('users').where({ openid: OPENID }).get()
  if (userResult.data.length === 0) return { code: 401, message: '用户不存在' }
  const user = userResult.data[0]
  if (user.role === 'admin') return { code: 0 }
  if (user.permissions && user.permissions.includes(permission)) return { code: 0 }
  return { code: 403, message: '无权限访问' }
}

// 读取系统配置（含 AI 密钥，仅云端使用，不落前端）
async function getConfig() {
  try {
    const res = await db.collection('system_config').doc('global').get()
    return res.data || {}
  } catch (e) {
    return {}
  }
}

// 调 OpenAI 兼容 /chat/completions 接口（中转站）
function chatCompletions(baseUrl, apiKey, model, messages, maxTokens) {
  return new Promise((resolve, reject) => {
    let url = (baseUrl || '').replace(/\/$/, '')
    if (!/\/chat\/completions$/.test(url)) url += '/chat/completions'
    const body = JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens || 600 })
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
    let u
    try { u = new URL(url) } catch (e) { reject(new Error('无效的接口地址')); return }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.error) return reject(new Error(json.error.message || 'AI 服务错误'))
          const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content
          resolve(content || '')
        } catch (e) { reject(new Error('解析 AI 响应失败')) }
      })
    })
    req.on('error', e => reject(e))
    req.setTimeout(20000, () => { req.destroy(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

// 抽取 JSON 数组（AI 可能包在 markdown 代码块/说明文字里）
function extractJsonArray(text) {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(arr) ? arr : null
  } catch (e) { return null }
}

// 用 AI 把口语文本解析为结构化清单，再对回商品库
async function parseWithAI(text, products, ai) {
  if (!ai || !ai.enabled || !ai.apiKey || !ai.baseUrl) return { used: false, items: [] }
  const model = ai.model || 'qwen-0810'
  const productNames = (products || []).map(pp => pp.name || '').filter(Boolean).slice(0, 200)
  const allNames = '[' + productNames.map(n => JSON.stringify(n)).join(', ') + ']'
  const system = '你是采购下单助手。根据用户口语订单，把每行解析为 {name, qty, unit, spec} 结构。' +
    'name 务必尽量匹配商品表中的标准名称（可用最接近的别名），unit 用 件/包/箱/个 等，qty 为数字。' +
    '商品表：' + allNames + '。只输出 JSON 数组，不要解释。'
  const user = '订单：' + text
  const content = await chatCompletions(ai.baseUrl, ai.apiKey, model, [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])
  const arr = extractJsonArray(content)
  if (!arr) return { used: true, items: [] }
  return { used: true, items: buildItems(arr, products) }
}

// TokenHub（腾讯云 OpenAI 兼容）NLP 解析：密钥独立存 ai.tokenhub
async function parseWithTokenhub(text, products, th) {
  if (!th || !th.enabled || !th.apiKey || !th.baseUrl) return { used: false, items: [] }
  const productNames = (products || []).map(pp => pp.name || '').filter(Boolean).slice(0, 200)
  const allNames = '[' + productNames.map(n => JSON.stringify(n)).join(', ') + ']'
  const system = '你是采购下单助手。根据用户口语订单，把每行解析为 {name, qty, unit, spec} 结构。' +
    'name 务必尽量匹配商品表中的标准名称（可用最接近的别名），unit 用 件/包/箱/个 等，qty 为数字。' +
    '商品表：' + allNames + '。只输出 JSON 数组，不要解释。'
  const models = Array.isArray(th.models) && th.models.length ? th.models
    : (th.model ? [th.model] : [])
  if (models.length === 0) return { used: false, items: [] }
  const msgs = [
    { role: 'system', content: system },
    { role: 'user', content: '订单：' + text }
  ]
  let lastErr = ''
  for (const model of models) {
    try {
      const content = await chatCompletions(th.baseUrl, th.apiKey, model, msgs, 800)
      const arr = extractJsonArray(content)
      if (arr) return { used: true, items: buildItems(arr, products), model }
      lastErr = 'model ' + model + ' 返回非数组内容'
    } catch (e) {
      lastErr = 'model ' + model + ' ' + (e.message || '')
    }
  }
  return { used: true, items: [], error: lastErr }
}

// 把 AI 返回的 JSON 行对回商品库（各 NLP 引擎共用）
function buildItems(arr, products) {
  const items = arr.map(it => {
    const product = (products || []).find(pp =>
      (it.name && (pp.name === it.name || pp.name.includes(it.name) || it.name.includes(pp.name))) ||
      (it.spec && pp.spec && pp.spec.includes(it.spec))
    )
    const qty = parseFloat(it.qty) || 1
    if (!product) {
      return { _id: '', name: it.name || '', spec: it.spec || '', price: 0, qty, unit: it.unit || '包', unmatched: true }
    }
    return {
      _id: product._id,
      name: product.name,
      spec: product.spec || '',
      price: product.price_piece || 0,
      qty,
      unit: it.unit || '包',
      material_code: product.material_code || '',
      pricing_mode: product.pricing_mode || 'case',
      price_unit: product.price_unit != null ? product.price_unit : 0
    }
  }).filter(it => it.name)
  return items
}

exports.main = async (event, context) => {
  __impersonatedOpenid = ((typeof process !== "undefined" && process.env && process.env.QA_IMPERSONATE === "1" && event && event.qaAsOpenid) ? event.qaAsOpenid : null)
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
      // 语音转文字（腾讯云 ASR 录音文件识别，音频走现有 CloudBase 存储临时链接）
      // event: { fileID?: CloudBase文件ID, audioUrl?: 公网音频地址, audioText?: 兜底纯文本 }
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const cfg = await getConfig()
      const tc = (cfg.ai && cfg.ai.tencent) || {}
      if (!tc.enabled || !tc.secretId || !tc.secretKey) {
        return { code: 0, data: { text: event.audioText || '', engine: 'disabled' } }
      }
      let audioUrl = event.audioUrl || ''
      if (!audioUrl && event.fileID) {
        try {
          const f = await cloud.getTempFileURL({ fileList: [event.fileID] })
          const file = (f.fileList || [])[0]
          if (file && file.status === 0 && file.tempFileURL) audioUrl = file.tempFileURL
        } catch (e) { /* 忽略，走兜底 */ }
      }
      if (!audioUrl) {
        return { code: 0, data: { text: event.audioText || '', engine: 'no-audio' } }
      }
      try {
        const text = await asrTranscribe({ secretId: tc.secretId, secretKey: tc.secretKey, engine: tc.engine || '16k_zh' }, audioUrl)
        return { code: 0, data: { text: text || '', engine: 'tencent-asr' } }
      } catch (e) {
        console.error('ASR 转写失败', e.message)
        return { code: 0, data: { text: event.audioText || '', engine: 'fallback', error: e.message } }
      }
    }
    
    case 'checkAsrReady': {
      // 供前端判断语音识别是否可用（不返回任何密钥）
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const cfg = await getConfig()
      const tc = (cfg.ai && cfg.ai.tencent) || {}
      return { code: 0, data: { ready: !!(tc.enabled && tc.secretId && tc.secretKey) } }
    }

    case 'checkNlpReady': {
      // 供前端判断 TokenHub NLP 是否可用（不返回任何密钥）
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const cfg = await getConfig()
      const th = (cfg.ai && cfg.ai.tokenhub) || {}
      return { code: 0, data: { ready: !!(th.enabled && th.apiKey && th.baseUrl) } }
    }

    case 'parse': {
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const { text } = event
      if (!text) return { code: 5002, message: 'text 参数为空' }
      
      const productsResult = await db.collection('products').get()
      const products = productsResult.data
      
      if (products.length === 0) {
        return { code: 5003, message: '暂无商品数据' }
      }
      
      const items = parseOrderText(text, products)
      
      return { code: 0, data: { items } }
    }

    case 'parseWithAI': {
      // 智能录入：优先规则引擎，规则未命中才调 AI（与千问/中转站并存，互为降级）
      const __p = await checkPermission('order:create'); if (__p.code !== 0) return __p
      const { text } = event
      if (!text) return { code: 5002, message: 'text 参数为空' }

      const productsResult = await db.collection('products').get()
      const products = productsResult.data

      if (products.length === 0) {
        return { code: 5003, message: '暂无商品数据' }
      }

      // 1. 先用本地规则引擎
      const ruleItems = parseOrderText(text, products)

      // 2. 读取 AI 配置（TokenHub 优先，relay 次之）
      const cfg = await getConfig()
      const ai = cfg.ai || {}
      const engines = []
      const th = (ai.tokenhub) || {}
      if (th.enabled && th.apiKey && th.baseUrl) engines.push({ kind: 'tokenhub', th })
      if (ai.relay && ai.relay.enabled && ai.relay.apiKey && ai.relay.baseUrl) engines.push({ kind: 'relay', eng: ai.relay })

      // 3. 规则已命中所有行则直接用；有未命中且配了引擎则走 AI
      if (ruleItems.length > 0) {
        return { code: 0, data: { items: ruleItems, engine: 'rule' } }
      }

      for (const eng of engines) {
        try {
          const aiResult = eng.kind === 'tokenhub'
            ? await parseWithTokenhub(text, products, eng.th)
            : await parseWithAI(text, products, {
                enabled: true,
                baseUrl: (eng.eng && eng.eng.baseUrl) || '',
                apiKey: (eng.eng && eng.eng.apiKey) || '',
                model: (eng.eng && eng.eng.model) || ''
              })
          if (aiResult.used && aiResult.items.length > 0) {
            return { code: 0, data: { items: aiResult.items, engine: 'ai' } }
          }
        } catch (e) {
          console.error('AI 解析失败，继续降级', e.message)
        }
      }

      return { code: 0, data: { items: ruleItems, engine: 'rule' } }
    }
    
    default:
      return { code: 1001, message: '未知 action' }
  }
}
