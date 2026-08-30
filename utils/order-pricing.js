/**
 * 订单计价与展示工具（对齐原型：件/包双轨 + 三种计价模式）
 * pricing_mode:
 *   - case : 按件·带包数 -> 件数×件价 + 包数×包价
 *   - piece: 按件         -> 件数×件价
 *   - unit : 按包/单件     -> 数量×单价(price_unit)
 */

function getUnitByMode(item, mode) {
  const u = item.unit || ''
  const parts = String(u).split('/')
  if (mode === 'piece' || mode === 'case') return parts[1] || '件'
  return parts[0] || '包'
}

function calcItemAmount(it) {
  const pieceQty = it.piece_qty || 0
  const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
  const pricePiece = it.price_piece || 0
  const priceUnit = it.price_unit != null ? it.price_unit : (it.price_zero || 0)
  const mode = it.pricing_mode || 'case'
  if (mode === 'piece') return pieceQty * pricePiece
  if (mode === 'unit') return packageQty * priceUnit
  return pieceQty * pricePiece + packageQty * priceUnit
}

function calcOrderAmount(items) {
  // T57-RB-7：分位整数累加后还原元——原 float 直加（0.1+0.2 型）会与
  // 服务端分位取整口径差 1 分（如 132.50 vs 132.51），导致前端总额与服务端重算不一致
  const cents = (items || []).reduce((sum, it) => sum + Math.round(calcItemAmount(it) * 100), 0)
  return Math.round(cents) / 100
}

// 数量合并展示（同商品 1 行）：2件+10包 / 2件 / 10包
function formatQtyCombined(it) {
  const pieceQty = it.piece_qty || 0
  const packageQty = it.package_qty != null ? it.package_qty : it.zero_qty || 0
  const mode = it.pricing_mode || 'case'
  const zeroUnit = getUnitByMode(it, 'zero')
  if (mode === 'piece') return pieceQty > 0 ? pieceQty + '件' : ''
  if (mode === 'unit') return packageQty > 0 ? packageQty + zeroUnit : ''
  if (pieceQty > 0 && packageQty > 0) return pieceQty + '件+' + packageQty + zeroUnit
  if (pieceQty > 0) return pieceQty + '件'
  if (packageQty > 0) return packageQty + zeroUnit
  return ''
}

function fmtMoney(n) {
  return Number(n || 0).toFixed(2)
}

module.exports = {
  getUnitByMode,
  calcItemAmount,
  calcOrderAmount,
  formatQtyCombined,
  fmtMoney,
  numberToChinese
}

/**
 * 数字转中文大写金额（对齐原型 numberToChinese）
 */
function numberToChinese(n) {
  const num = Number(n) || 0
  if (!num || num === 0) {
    return '零元整'
  }
  const frac = Math.round((num - Math.floor(num)) * 100)
  const intPart = Math.floor(num)
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const units = ['', '拾', '佰', '仟']
  const bigUnits = ['', '万', '亿']
  let s = ''
  let i = 0
  let numStr = String(intPart)
  while (numStr.length > 0) {
    const chunk = numStr.slice(-4)
    numStr = numStr.slice(0, -4)
    let chunkStr = ''
    let zeroFlag = false
    for (let j = 0; j < chunk.length; j++) {
      const d = parseInt(chunk[j])
      const pos = chunk.length - 1 - j
      if (d === 0) { zeroFlag = true; continue }
      if (zeroFlag) { chunkStr += '零'; zeroFlag = false }
      chunkStr += digits[d] + units[pos]
    }
    if (chunkStr) s = chunkStr + bigUnits[i] + s
    else if (s && !s.startsWith('零')) s = '零' + s
    i++
  }
  if (intPart === 0 && !s) s = ''
  if (frac > 0) {
    if (intPart === 0) s = '零'
    const f1 = Math.floor(frac / 10)
    const f2 = frac % 10
    s += '元'
    if (f1 > 0) s += digits[f1] + '角'
    if (f2 > 0) s += digits[f2] + '分'
  } else {
    s += '元整'
  }
  return s || '零元整'
}
