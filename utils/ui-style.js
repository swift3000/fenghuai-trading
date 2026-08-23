/**
 * 运行时字号样式工具
 * 为每个页面根容器生成内联 CSS 变量串：
 *  - 全局字号跟随微信系统设置（--font-scale，0.7-1.3 夹取）
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
// 字号跟随微信系统设置：从 app.globalData.fontScale 取（onLaunch 时按系统字号映射），不再读本地 storage
function currentVarStyle() {
  let fs = 1.0
  try {
    const app = getApp()
    if (app && app.globalData && Number.isFinite(Number(app.globalData.fontScale))) {
      fs = Number(app.globalData.fontScale)
    }
  } catch (e) {}
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
