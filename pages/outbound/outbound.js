const { guardPageLoad } = require('../../utils/router-guard')

Page({
  data: { 
    subTab: 'sort', 
    pendingSort: [], 
    doneSort: [], 
    pendingOut: [], 
    doneOut: [],
    loading: false
  },
  
  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },
  
  onShow() { 
    this.loadData() 
  },
  
  switchSub(e) { 
    this.setData({ subTab: e.currentTarget.dataset.tab })
    this.loadData() 
  },
  
  async loadData() {
    this.setData({ loading: true })
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('orders', { 
        action: 'outboundList', 
        subTab: this.data.subTab 
      })
      this.setData({ 
        pendingSort: data.data || [],
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
  
  async handleOut(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'confirmOut',
        orderId: orderId,
        batchMode: false
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
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },
  
  async handleAllOut() {
    if (this.data.pendingSort.length === 0) {
      wx.showToast({ title: '没有待出库订单', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '确认',
      content: `确定要全部出库吗？共 ${this.data.pendingSort.length} 个订单`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const { callCloud } = require('../../utils/request')
            await callCloud('orders', {
              action: 'confirmOut',
              batchMode: true
            })
            wx.showToast({ title: '全部出库完成', icon: 'success' })
            this.loadData()
          } catch (e) {
            console.error('全部出库失败', e)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }
})
