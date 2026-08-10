Page({
  data: { order: null, items: [] },
  onLoad(options) { if (options.orderId) this.loadOrder(options.orderId) },
  async loadOrder(id) {
    try {
      const { callCloud } = require('../../utils/request')
      const order = await callCloud('orders', { action: 'detail', orderId: id })
      this.setData({ order, items: order.items || [] })
    } catch (e) { wx.showToast({ title: '加载失败', icon: 'none' }) }
  },
  handlePrint() { wx.showToast({ title: '打印送货单', icon: 'none' }) },
  handleExport() { wx.showToast({ title: '导出Excel', icon: 'none' }) }
})
