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
  return (items || []).reduce((sum, it) => sum + calcItemAmount(it), 0)
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
  fmtMoney
}
