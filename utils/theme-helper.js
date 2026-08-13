/**
 * 主题切换工具
 * 支持多类主题：基础色、卡通 IP、视觉风格、节日季节
 */

const THEMES = {
  // ========== 基础色主题 ==========
  green: {
    name: '清新绿',
    type: '基础色',
    primary: '#06AD56',
    primaryLight: '#06c167',
    primaryBg: '#E8F5E9',
    secondary: '#FF6B35',
    bg: '#F5F6F8',
    card: '#FFFFFF',
    text: '#191919',
    textSecondary: '#888888',
    border: '#EFEFEF',
    tabBar: '#FFFFFF',
    tabBarActive: '#06AD56',
    borderRadius: '16rpx',
    icon: '🟢'
  },
  blue: {
    name: '商务蓝',
    type: '基础色',
    primary: '#1890FF',
    primaryLight: '#40A9FF',
    primaryBg: '#E6F7FF',
    secondary: '#FA8C16',
    bg: '#F0F5FF',
    card: '#FFFFFF',
    text: '#191919',
    textSecondary: '#888888',
    border: '#EFEFEF',
    tabBar: '#FFFFFF',
    tabBarActive: '#1890FF',
    borderRadius: '16rpx',
    icon: '🔵'
  },
  orange: {
    name: '活力橙',
    type: '基础色',
    primary: '#FA8C16',
    primaryLight: '#FFC53D',
    primaryBg: '#FFF7E6',
    secondary: '#06AD56',
    bg: '#FFF7E6',
    card: '#FFFFFF',
    text: '#191919',
    textSecondary: '#888888',
    border: '#EFEFEF',
    tabBar: '#FFFFFF',
    tabBarActive: '#FA8C16',
    borderRadius: '16rpx',
    icon: '🟠'
  },
  purple: {
    name: '优雅紫',
    type: '基础色',
    primary: '#722ED1',
    primaryLight: '#9254DE',
    primaryBg: '#F9F0FF',
    secondary: '#FA541C',
    bg: '#F9F0FF',
    card: '#FFFFFF',
    text: '#191919',
    textSecondary: '#888888',
    border: '#EFEFEF',
    tabBar: '#FFFFFF',
    tabBarActive: '#722ED1',
    borderRadius: '16rpx',
    icon: '🟣'
  },
  dark: {
    name: '暗夜黑',
    type: '基础色',
    primary: '#52C41A',
    primaryLight: '#73D13D',
    primaryBg: '#2A2A2A',
    secondary: '#FA8C16',
    bg: '#141414',
    card: '#1F1F1F',
    text: '#FFFFFF',
    textSecondary: '#A6A6A6',
    border: '#333333',
    tabBar: '#1F1F1F',
    tabBarActive: '#52C41A',
    borderRadius: '16rpx',
    icon: '⚫'
  },

  // ========== 卡通 IP 主题 ==========
  panda: {
    name: '萌趣熊猫',
    type: '卡通 IP',
    primary: '#5C5C5C',
    primaryLight: '#808080',
    primaryBg: '#FFF1DF',
    secondary: '#FFFFFF',
    bg: '#FFF9F0',
    card: '#FFFFFF',
    text: '#333333',
    textSecondary: '#999999',
    border: '#FFE4B5',
    tabBar: '#FFFFFF',
    tabBarActive: '#5C5C5C',
    borderRadius: '24rpx',
    icon: '🐼'
  },
  cat: {
    name: '暖心猫咪',
    type: '卡通 IP',
    primary: '#FF9A9E',
    primaryLight: '#FFB4B8',
    primaryBg: '#FFEFF2',
    secondary: '#FECFEF',
    bg: '#FFF5F7',
    card: '#FFFFFF',
    text: '#4A4A4A',
    textSecondary: '#999999',
    border: '#FFD1DC',
    tabBar: '#FFFFFF',
    tabBarActive: '#FF9A9E',
    borderRadius: '24rpx',
    icon: '🐱'
  },
  dog: {
    name: '活泼小狗',
    type: '卡通 IP',
    primary: '#F6D365',
    primaryLight: '#F8DA7E',
    primaryBg: '#FFF5DC',
    secondary: '#FDA085',
    bg: '#FFFBF0',
    card: '#FFFFFF',
    text: '#5A4A3A',
    textSecondary: '#999999',
    border: '#FFE4B5',
    tabBar: '#FFFFFF',
    tabBarActive: '#F6D365',
    borderRadius: '24rpx',
    icon: '🐶'
  },
  fox: {
    name: '灵动小狐',
    type: '卡通 IP',
    primary: '#FF6B6B',
    primaryLight: '#FF8585',
    primaryBg: '#FFEBE7',
    secondary: '#FFE66D',
    bg: '#FFF8F5',
    card: '#FFFFFF',
    text: '#4A3A3A',
    textSecondary: '#999999',
    border: '#FFD4C4',
    tabBar: '#FFFFFF',
    tabBarActive: '#FF6B6B',
    borderRadius: '24rpx',
    icon: '🦊'
  },
  bear: {
    name: '憨厚小熊',
    type: '卡通 IP',
    primary: '#A07855',
    primaryLight: '#B89270',
    primaryBg: '#F5E8DD',
    secondary: '#D4A574',
    bg: '#FDF8F3',
    card: '#FFFFFF',
    text: '#4A3A30',
    textSecondary: '#999999',
    border: '#E8D5C4',
    tabBar: '#FFFFFF',
    tabBarActive: '#A07855',
    borderRadius: '24rpx',
    icon: '🐻'
  },

  // ========== 视觉风格主题 ==========
  glass: {
    name: '毛玻璃',
    type: '视觉风格',
    primary: '#667eea',
    primaryLight: '#768ba0',
    primaryBg: 'rgba(255,255,255,0.35)',
    secondary: '#764ba2',
    bg: '#F0F2F5',
    card: 'rgba(255,255,255,0.7)',
    text: '#333333',
    textSecondary: '#666666',
    border: 'rgba(255,255,255,0.5)',
    tabBar: 'rgba(255,255,255,0.8)',
    tabBarActive: '#667eea',
    borderRadius: '20rpx',
    icon: '✨'
  },
  rounded: {
    name: '圆角卡片',
    type: '视觉风格',
    primary: '#4facfe',
    primaryLight: '#6bb9ff',
    primaryBg: '#EFF6FF',
    secondary: '#00f2fe',
    bg: '#F5F7FA',
    card: '#FFFFFF',
    text: '#2D3748',
    textSecondary: '#718096',
    border: '#E2E8F0',
    tabBar: '#FFFFFF',
    tabBarActive: '#4facfe',
    borderRadius: '32rpx',
    icon: '🔲'
  },
  gradient: {
    name: '渐变流光',
    type: '视觉风格',
    primary: '#fa709a',
    primaryLight: '#fee140',
    primaryBg: '#FDF3F7',
    secondary: '#a18cd1',
    bg: '#FDFBF7',
    card: '#FFFFFF',
    text: '#2D2D2D',
    textSecondary: '#888888',
    border: '#F0E8E0',
    tabBar: '#FFFFFF',
    tabBarActive: '#fa709a',
    borderRadius: '18rpx',
    icon: '🌈'
  },
  minimal: {
    name: '极简黑白',
    type: '视觉风格',
    primary: '#000000',
    primaryLight: '#333333',
    primaryBg: '#F5F5F5',
    secondary: '#666666',
    bg: '#FFFFFF',
    card: '#F8F8F8',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    tabBar: '#FFFFFF',
    tabBarActive: '#000000',
    borderRadius: '12rpx',
    icon: '⚪'
  },

  // ========== 节日/季节主题 ==========
  christmas: {
    name: '🎄 圣诞欢乐',
    type: '节日季节',
    primary: '#C41E3A',
    primaryLight: '#DC143C',
    primaryBg: '#FFECEC',
    secondary: '#228B22',
    bg: '#FFF5F5',
    card: '#FFFFFF',
    text: '#2D2D2D',
    textSecondary: '#888888',
    border: '#FFE4E1',
    tabBar: '#FFFFFF',
    tabBarActive: '#C41E3A',
    borderRadius: '20rpx',
    icon: '🎄'
  },
  newyear: {
    name: '🧧 新春喜庆',
    type: '节日季节',
    primary: '#D90429',
    primaryLight: '#EF233C',
    primaryBg: '#FFF0E0',
    secondary: '#FFD700',
    bg: '#FFF8F0',
    card: '#FFFFFF',
    text: '#2D2D2D',
    textSecondary: '#888888',
    border: '#FFE4D0',
    tabBar: '#FFFFFF',
    tabBarActive: '#D90429',
    borderRadius: '20rpx',
    icon: '🧧'
  },
  spring: {
    name: '🌸 春日清新',
    type: '节日季节',
    primary: '#FF69B4',
    primaryLight: '#FFB6C1',
    primaryBg: '#FFF0F5',
    secondary: '#90EE90',
    bg: '#FFF9FA',
    card: '#FFFFFF',
    text: '#3D3D3D',
    textSecondary: '#888888',
    border: '#FFE4E9',
    tabBar: '#FFFFFF',
    tabBarActive: '#FF69B4',
    borderRadius: '20rpx',
    icon: '🌸'
  },
  summer: {
    name: '☀️ 夏日清凉',
    type: '节日季节',
    primary: '#00B4D8',
    primaryLight: '#48CAE4',
    primaryBg: '#E6F7FF',
    secondary: '#FFD166',
    bg: '#F0F9FF',
    card: '#FFFFFF',
    text: '#2D3748',
    textSecondary: '#718096',
    border: '#E0F2FE',
    tabBar: '#FFFFFF',
    tabBarActive: '#00B4D8',
    borderRadius: '20rpx',
    icon: '☀️'
  },
  autumn: {
    name: '🍂 秋日温暖',
    type: '节日季节',
    primary: '#D2691E',
    primaryLight: '#E9967A',
    primaryBg: '#FFF2E3',
    secondary: '#DAA520',
    bg: '#FFF8F0',
    card: '#FFFFFF',
    text: '#4A3A30',
    textSecondary: '#999999',
    border: '#FFE4C4',
    tabBar: '#FFFFFF',
    tabBarActive: '#D2691E',
    borderRadius: '20rpx',
    icon: '🍂'
  },
  winter: {
    name: '❄️ 冬日纯净',
    type: '节日季节',
    primary: '#4A90A4',
    primaryLight: '#6FA8BC',
    primaryBg: '#EAF6FA',
    secondary: '#B8D4E3',
    bg: '#F8FCFF',
    card: '#FFFFFF',
    text: '#2D3748',
    textSecondary: '#718096',
    border: '#E8F4F8',
    tabBar: '#FFFFFF',
    tabBarActive: '#4A90A4',
    borderRadius: '20rpx',
    icon: '❄️'
  }
}

// 主题分类
const THEME_CATEGORIES = {
  '基础色': ['green', 'blue', 'orange', 'purple', 'dark'],
  '卡通 IP': ['panda', 'cat', 'dog', 'fox', 'bear'],
  '视觉风格': ['glass', 'rounded', 'gradient', 'minimal'],
  '节日季节': ['christmas', 'newyear', 'spring', 'summer', 'autumn', 'winter']
}

/**
 * 设置主题
 */
function setTheme(themeKey) {
  const theme = THEMES[themeKey]
  if (!theme) {
    console.error('未知的主题:', themeKey)
    return THEMES.green
  }

  wx.setStorageSync('theme', themeKey)
  wx.setStorageSync('themeConfig', theme)

  try {
    wx.setNavigationBarColor({
      frontColor: theme.text === '#FFFFFF' || theme.text === 'rgba(255,255,255,1)' ? '#000000' : '#ffffff',
      backgroundColor: theme.primary,
      animation: { duration: 200, timingFunc: 'easeIn' }
    })
  } catch (e) {
    console.error('设置导航栏颜色失败:', e)
  }

  // 动态更新底部 TabBar 高亮色以匹配主题
  try {
    wx.setTabBarStyle({ selectedColor: theme.tabBarActive || theme.primary })
  } catch (e) {
    console.error('设置 TabBar 主题色失败:', e)
  }

  console.log('主题已切换为:', theme.name)
  return theme
}

/**
 * 获取当前主题
 */
function getCurrentTheme() {
  const themeKey = wx.getStorageSync('theme') || 'green'
  return THEMES[themeKey] || THEMES.green
}

/**
 * 获取当前主题键值
 */
function getCurrentThemeKey() {
  return wx.getStorageSync('theme') || 'green'
}

/**
 * 获取所有可用主题（按分类）
 */
function getAvailableThemes() {
  const result = []
  for (const [category, keys] of Object.entries(THEME_CATEGORIES)) {
    result.push({
      category,
      themes: keys.map(key => ({
        key,
        name: THEMES[key].name,
        icon: THEMES[key].icon,
        primary: THEMES[key].primary
      }))
    })
  }
  return result
}

/**
 * 初始化主题
 */
function initTheme() {
  const themeKey = getCurrentThemeKey()
  const theme = getCurrentTheme()
  return theme
}

module.exports = {
  setTheme,
  getCurrentTheme,
  getCurrentThemeKey,
  getAvailableThemes,
  initTheme,
  THEMES,
  THEME_CATEGORIES
}
