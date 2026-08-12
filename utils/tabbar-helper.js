/**
 * TabBar 动态配置工具
 * 根据用户角色动态显示/隐藏 TabBar
 */

const app = getApp()

// 角色对应的 TabBar 配置
const ROLE_TABBAR_CONFIG = {
  admin: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'assets/icons/home.png',
      selectedIconPath: 'assets/icons/home-active.png'
    },
    {
      pagePath: 'pages/orders/orders',
      text: '订单',
      iconPath: 'assets/icons/order.png',
      selectedIconPath: 'assets/icons/order-active.png'
    },
    {
      pagePath: 'pages/receivable/receivable',
      text: '赊销',
      iconPath: 'assets/icons/money.png',
      selectedIconPath: 'assets/icons/money-active.png'
    },
    {
      pagePath: 'pages/outbound/outbound',
      text: '分拣出库',
      iconPath: 'assets/icons/outbound.png',
      selectedIconPath: 'assets/icons/outbound-active.png'
    },
    {
      pagePath: 'pages/profile/profile',
      text: '我的',
      iconPath: 'assets/icons/profile.png',
      selectedIconPath: 'assets/icons/profile-active.png'
    }
  ],
  orderer: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'assets/icons/home.png',
      selectedIconPath: 'assets/icons/home-active.png'
    },
    {
      pagePath: 'pages/orders/orders',
      text: '订单',
      iconPath: 'assets/icons/order.png',
      selectedIconPath: 'assets/icons/order-active.png'
    },
    {
      pagePath: 'pages/profile/profile',
      text: '我的',
      iconPath: 'assets/icons/profile.png',
      selectedIconPath: 'assets/icons/profile-active.png'
    }
  ],
  sorter: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'assets/icons/home.png',
      selectedIconPath: 'assets/icons/home-active.png'
    },
    {
      pagePath: 'pages/outbound/outbound',
      text: '分拣出库',
      iconPath: 'assets/icons/outbound.png',
      selectedIconPath: 'assets/icons/outbound-active.png'
    },
    {
      pagePath: 'pages/profile/profile',
      text: '我的',
      iconPath: 'assets/icons/profile.png',
      selectedIconPath: 'assets/icons/profile-active.png'
    }
  ],
  warehouse: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'assets/icons/home.png',
      selectedIconPath: 'assets/icons/home-active.png'
    },
    {
      pagePath: 'pages/outbound/outbound',
      text: '分拣出库',
      iconPath: 'assets/icons/outbound.png',
      selectedIconPath: 'assets/icons/outbound-active.png'
    },
    {
      pagePath: 'pages/profile/profile',
      text: '我的',
      iconPath: 'assets/icons/profile.png',
      selectedIconPath: 'assets/icons/profile-active.png'
    }
  ]
}

/**
 * 微信小程序 tabBar 的全部条目（顺序与 app.json 保持一致，索引即下标）
 * 用于把「角色可见的 tab 列表」映射回固定索引，配合 setTabBarItem / showTabBarItem / hideTabBarItem
 */
const ALL_TAB_ITEMS = [
  { index: 0, pagePath: 'pages/index/index' },
  { index: 1, pagePath: 'pages/orders/orders' },
  { index: 2, pagePath: 'pages/receivable/receivable' },
  { index: 3, pagePath: 'pages/outbound/outbound' },
  { index: 4, pagePath: 'pages/profile/profile' }
]

/**
 * 根据角色设置 TabBar
 * 用标准 API wx.setTabBarItem（设置 icon/text）+ wx.showTabBarItem / wx.hideTabBarItem（按角色显隐）
 * 替代非标准、真机上静默失败的 wx.setTabBarList
 * @param {string} role - 用户角色
 */
function setTabBarByRole(role) {
  const tabBarConfig = ROLE_TABBAR_CONFIG[role]
  if (!tabBarConfig) {
    console.error('未知的角色:', role)
    return
  }

  try {
    // 该角色可见的 pagePath 集合
    const visiblePaths = tabBarConfig.map(item => item.pagePath)

    ALL_TAB_ITEMS.forEach(item => {
      const config = tabBarConfig.find(c => c.pagePath === item.pagePath)
      if (config) {
        // 设置图标与文案（index 为固定下标，notSet 之外的字段会更新）
        wx.setTabBarItem({
          index: item.index,
          text: config.text,
          iconPath: config.iconPath,
          selectedIconPath: config.selectedIconPath
        })
        wx.showTabBarItem({ index: item.index })
      } else {
        wx.hideTabBarItem({ index: item.index })
      }
    })

    console.log('TabBar 已更新为:', role, '可见 tab:', visiblePaths.join(','))
  } catch (err) {
    console.error('设置 TabBar 失败:', err)
  }
}

/**
 * 显示/隐藏 TabBar
 * @param {boolean} show - 是否显示
 */
function showTabBar(show) {
  try {
    wx.showTabBar()
    if (show === false) {
      wx.hideTabBar()
    }
  } catch (err) {
    console.error('控制 TabBar 显示失败:', err)
  }
}

/**
 * 更新 TabBar 徽章
 * @param {number} index - Tab 索引
 * @param {string} text - 徽章文本
 */
function setTabBarBadge(index, text) {
  try {
    wx.setTabBarBadge({
      index,
      text
    })
  } catch (err) {
    console.error('设置 TabBar 徽章失败:', err)
  }
}

/**
 * 移除 TabBar 徽章
 * @param {number} index - Tab 索引
 */
function removeTabBarBadge(index) {
  try {
    wx.removeTabBarBadge({
      index
    })
  } catch (err) {
    console.error('移除 TabBar 徽章失败:', err)
  }
}

module.exports = {
  setTabBarByRole,
  showTabBar,
  setTabBarBadge,
  removeTabBarBadge,
  ROLE_TABBAR_CONFIG,
  ALL_TAB_ITEMS
}
