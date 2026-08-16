/**
 * 运行时字号样式工具
 * 为每个页面根容器生成内联 CSS 变量串：
 *  - 全局字号缩放 70%-130% 实时生效（--font-scale）
 * 主题配色已锁定为默认绿色（见 app.wxss page 变量），不再提供切换。
 */
const MIN_SCALE = 0.7
const MAX_SCALE = 1.3

// 构建根容器内联 CSS 变量串（仅字号）
function buildVarStyle(themeKey, fontScale) {
  let fs = Number(fontScale)
  if (isNaN(fs)) fs = 1
  fs = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fs))
  return `--font-scale:${fs};`
}

// 当前应注入的变量串（供页面 onShow/onLoad 调用）
function currentVarStyle() {
  let fs = Number(wx.getStorageSync('fontScale'))
  if (isNaN(fs)) fs = 0.9
  return buildVarStyle('', fs)
}

/**
 * 页面便捷：把 uiStyle 写入 page.data 并 setData
 * 用法：在页面 onShow/onLoad 里调用 applyUiStyle(this)
 */
function applyUiStyle(page) {
  const uiStyle = currentVarStyle()
  if (!page.data) page.data = {}
  page.data.uiStyle = uiStyle
  if (typeof page.setData === 'function') {
    page.setData({ uiStyle })
  }
  return uiStyle
}

module.exports = { buildVarStyle, currentVarStyle, applyUiStyle, MIN_SCALE, MAX_SCALE }
