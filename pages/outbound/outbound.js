const { guardPageLoad } = require('../../utils/router-guard')

const tabbarHelper = require('../../utils/tabbar-helper')
const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '', 
    subTab: 'sort', 
    canSort: false,
    canOut: false,
    pendingSort: [], 
    doneSort: [], 
    pendingOut: [], 
    doneOut: [],
    outTab: 'pending',
    loading: false,
    canExport: false,
    // 出库确认弹窗
    showOutModal: false,
    outModalOrderId: null,
    outModalCustomer: '',
    outModalItems: [],
    outForm: {
      large: '',
      medium: '',
      small: ''
    }
  },

  // 订单 -> 展示对象（商品行合并数量、0不显示；内联物流 大件×n·中件×n·小件×n，0不显示）
  formatOrder(o) {
    const items = (o.items || []).map(it => {
      const pq = Number(it.piece_qty || 0)
      const zq = Number(it.package_qty != null ? it.package_qty : it.zero_qty || 0)
      let qtyText = ''
      if (pq > 0 && zq > 0) qtyText = pq + '件+' + zq + (it.zero_unit || '包')
      else if (pq > 0) qtyText = pq + '件'
      else if (zq > 0) qtyText = zq + (it.zero_unit || '包')
      return { name: it.name, qtyText, show: pq > 0 || zq > 0, remark: it.remark }
    }).filter(x => x.show)
    const big = Number(o.ship_large || 0), mid = Number(o.ship_medium || 0), sm = Number(o.ship_small || 0)
    const parts = []
    if (big > 0) parts.push('大件×' + big)
    if (mid > 0) parts.push('中件×' + mid)
    if (sm > 0) parts.push('小件×' + sm)
    const raw = o.created_at || 0
    const ms = raw && raw.$date ? raw.$date : (raw || Date.now())
    const d = new Date(ms)
    const pad = n => String(n).padStart(2, '0')
    return Object.assign({}, o, {
      items,
      pkgText: parts.join(' · '),
      _pkg: { big, mid, sm },
      timeText: pad(d.getHours()) + ':' + pad(d.getMinutes())
    })
  },
  
  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    const canSort = perms.includes('sort:task')
    const canOut = perms.includes('warehouse:confirm')
    this.setData({
      canSort,
      canOut,
      canExport: perms.includes('warehouse:confirm'),
      subTab: canOut ? 'out' : 'sort'
    })
  },
  
  onShow() {
    tabbarHelper.refreshCustomTabBar('workbench')
    uiStyle.applyUiStyle(this) 
    this.loadData() 
  },
  
  switchSub(e) { 
    this.setData({ subTab: e.currentTarget.dataset.tab })
    this.loadData() 
  },

  switchOutTab(e) {
    this.setData({ outTab: e.currentTarget.dataset.tab })
  },
  
  async loadData() {
    this.setData({ loading: true })
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('orders', { 
        action: 'outboundList', 
        subTab: this.data.subTab 
      })
      const pendingSort = (data.pendingSort || []).map(o => this.formatOrder(o))
      const pendingOut = (data.pendingOut || []).map(o => this.formatOrder(o))
      const doneOut = (data.doneOut || []).map(o => this.formatOrder(o))
      this.setData({ 
        // callCloud 已解包 res.result.data
        pendingSort,
        pendingOut,
        doneOut,
        loading: false
      })
    } catch (e) {
      console.error('加载数据失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },
  
  async handleSort(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'confirmSort',
        orderId: orderId,
        batchMode: false
      })
      wx.showToast({ title: '分拣完成', icon: 'success' })
      this.loadData()
    } catch (e) {
      console.error('分拣失败', e)
      wx.showToast({ title: '分拣失败', icon: 'none' })
    }
  },
  
  // 点击出库确认 - 打开弹窗
  handleOutClick(e) {
    const orderId = e.currentTarget.dataset.id
    const customer = e.currentTarget.dataset.customer
    const items = e.currentTarget.dataset.items || []
    
    if (!orderId) return
    // 修改场景：回填当前订单已填件数
    const list = this.data.pendingOut.concat(this.data.doneOut)
    const cur = list.find(o => o._id === orderId)
    const pkg = (cur && cur._pkg) || { big: 0, mid: 0, sm: 0 }
    this.setData({
      showOutModal: true,
      outModalOrderId: orderId,
      outModalCustomer: customer,
      outModalItems: items,
      outForm: {
        large: pkg.big > 0 ? String(pkg.big) : '',
        medium: pkg.mid > 0 ? String(pkg.mid) : '',
        small: pkg.sm > 0 ? String(pkg.sm) : ''
      }
    })
  },
  
  // 表单输入处理
  onOutFormInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`outForm.${field}`]: value
    })
  },
  
  // 隐藏弹窗
  hideOutModal() {
    this.setData({
      showOutModal: false,
      outModalOrderId: null,
      outModalCustomer: '',
      outModalItems: [],
      outForm: {
        large: '',
        medium: '',
        small: ''
      }
    })
  },
  
  // 阻止弹窗点击穿透
  stopPropagation() {},
  
  // 提交出库确认
  async confirmOutSubmit() {
    const orderId = this.data.outModalOrderId
    const large = parseInt(this.data.outForm.large) || 0
    const medium = parseInt(this.data.outForm.medium) || 0
    const small = parseInt(this.data.outForm.small) || 0
    
    if (!orderId) {
      wx.showToast({ title: '订单ID缺失', icon: 'none' })
      return
    }
    
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'confirmOut',
        orderId: orderId,
        batchMode: false,
        ship_large: large,
        ship_medium: medium,
        ship_small: small
      })
      wx.showToast({ title: '出库完成', icon: 'success' })
      this.hideOutModal()
      this.loadData()
    } catch (e) {
      console.error('出库失败', e)
      wx.showToast({ title: '出库失败: ' + (e.errMsg || ''), icon: 'none' })
    }
  },
  
  async handleOut(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'confirmOut',
        orderId: orderId,
        batchMode: false,
        ship_large: 0,
        ship_medium: 0,
        ship_small: 0
      })
      wx.showToast({ title: '出库完成', icon: 'success' })
      this.loadData()
    } catch (e) {
      console.error('出库失败', e)
      wx.showToast({ title: '出库失败', icon: 'none' })
    }
  },
  
  async handleAllSort() {
    if (this.data.pendingSort.length === 0) {
      wx.showToast({ title: '没有待分拣订单', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '确认',
      content: `确定要全部分拣吗？共 ${this.data.pendingSort.length} 个订单`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const { callCloud } = require('../../utils/request')
            await callCloud('orders', {
              action: 'confirmSort',
              batchMode: true
            })
            wx.showToast({ title: '全部分拣完成', icon: 'success' })
            this.loadData()
          } catch (e) {
            console.error('全部分拣失败', e)
            wx.showToast({ title: '全部分拣失败', icon: 'none' })
          }
        }
      }
    })
  },
  
  // 导出库单（不含价格，含大/中/小件）— 对标原型 exportWarehouseOut
  async handleExportOutbound() {
    try {
      wx.showLoading({ title: '导出中...' })
      const { callCloud } = require('../../utils/request')
      const result = await callCloud('orders', { action: 'exportOutbound' })
      const { csvContent, filename } = result || {}
      if (!csvContent) {
        wx.showToast({ title: '今日暂无已出库订单', icon: 'none' })
        return
      }
      const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
      wx.getFileSystemManager().writeFileSync(filePath, csvContent, 'utf8')
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      wx.hideLoading()
      wx.showModal({
        title: '导出台单成功',
        content: `库单已保存到:\n${filePath}`,
        showCancel: false
      })
    } catch (e) {
      console.error('导出台单失败', e)
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  async handleAllOut() {
    if (this.data.pendingOut.length === 0) {
      wx.showToast({ title: '没有待出库订单', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '确认',
      content: `确定要全部出库吗？共 ${this.data.pendingOut.length} 个订单\n注意：批量出库将默认大件/中件/小件为0`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const { callCloud } = require('../../utils/request')
            await callCloud('orders', {
              action: 'confirmOut',
              batchMode: true,
              ship_large: 0,
              ship_medium: 0,
              ship_small: 0
            })
            wx.showToast({ title: '全部出库完成', icon: 'success' })
            this.loadData()
          } catch (e) {
            console.error('全部出库失败', e)
            wx.showToast({ title: '全部出库失败', icon: 'none' })
          }
        }
      }
    })
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
