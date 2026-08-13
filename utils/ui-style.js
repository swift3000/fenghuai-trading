/**
 * 运行时主题与字号样式工具
 * 为每个页面根容器生成一组内联 CSS 变量字符串，实现：
 *  - 主题切换实时生效（--theme-*）
 *  - 全局字号缩放 70%-130% 实时生效（--font-scale）
 * 对应 WXSS 用 var(--theme-*) / calc(Nrpx * var(--font-scale)) 消费。
 */
const themeHelper = require('./theme-helper')

const MIN_SCALE = 0.7
const MAX_SCALE = 1.3

function currentThemeKey() {
  return themeHelper.getCurrentThemeKey()
}

// 构建根容器内联 CSS 变量串
function buildVarStyle(themeKey, fontScale) {
  const t = themeHelper.THEMES[themeKey] || themeHelper.THEMES.green
  let fs = Number(fontScale)
  if (isNaN(fs)) fs = 1
  fs = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fs))
  return [
    `--theme-primary:${t.primary};`,
    `--theme-primary-light:${t.primaryLight};`,
    `--theme-primary-bg:${t.primaryBg || '#E8F5E9'};`,,
    `--theme-secondary:${t.secondary};`,
    `--theme-bg:${t.bg};`,
    `--theme-card:${t.card};`,
    `--theme-text:${t.text};`,
    `--theme-text-secondary:${t.textSecondary};`,
    `--theme-border:${t.border};`,
    `--theme-tab-bar:${t.tabBar};`,
    `--theme-tab-bar-active:${t.tabBarActive};`,
    `--font-scale:${fs};`
  ].join('')
}

// 当前应注入的变量串（供页面 onShow/onLoad 调用）
function currentVarStyle() {
  const theme = currentThemeKey()
  let fs = Number(wx.getStorageSync('fontScale'))
  if (isNaN(fs)) fs = 0.9
  return buildVarStyle(theme, fs)
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
