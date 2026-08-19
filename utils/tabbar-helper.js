/**
 * TabBar 动态配置工具
 * 根据用户角色动态显示/隐藏 TabBar
 */

/**
 * 根据权限键动态设置 TabBar（对齐原型：赊销=receivable:view；分拣出库=sort:task||warehouse:confirm）
 * 订单 tab 默认始终显示（order:view 默认全员开放）。
 * @param {string[]} permissions - 当前用户权限数组
 */
function setTabBarByPerms(permissions) {
  // 使用自定义 TabBar 后，原生 tabBar 已隐藏，无需显隐原生条目。
  // 这里仅刷新自定义栏（权限/主题），保持旧调用签名兼容。
  refreshCustomTabBar()
}

function setTabBarByRole(role) {
  // 使用自定义 TabBar 后，按角色显隐原生条目已无意义。
  // 仅刷新自定义栏，保持旧调用签名兼容。
  refreshCustomTabBar()
}

/**
 * 显示/隐藏 TabBar
 * @param {boolean} show - 是否显示
 */
function showTabBar(show) {
  // 自定义 TabBar 由页面渲染，无需原生 show/hide；保留签名兼容。
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


/**
 * 刷新自定义底部 TabBar（custom-tab-bar）
 * 由真实 Tab 页在 onShow 时调用：标记当前高亮并刷新权限/主题。
 * @param {string} active - 当前高亮的 key: home/orders/workbench/profile
 */
function refreshCustomTabBar(active) {
  const pages = getCurrentPages()
  if (!pages || !pages.length) return
  const page = pages[pages.length - 1]
  if (typeof page.getTabBar === 'function') {
    const bar = page.getTabBar()
    if (bar) {
      if (active && typeof bar.setData === 'function') {
        bar.setData({ active: active })
      }
      if (typeof bar.refresh === 'function') {
        bar.refresh()
      }
    }
  }
}

module.exports = {
  setTabBarByRole,
  setTabBarByPerms,
  showTabBar,
  setTabBarBadge,
  removeTabBarBadge,
  refreshCustomTabBar
}
