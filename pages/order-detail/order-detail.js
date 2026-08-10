Page({
  data: {
    order: null,
    items: [],
    customer: null,
    paymentStatus: '',
    paymentStatusText: ''
  },

  onLoad(options) {
    if (options.id) {
      this.loadOrderDetail(options.id)
    }
  },

  async loadOrderDetail(id) {
    try {
      const { callCloud } = require('../../utils/request')
      const order = await callCloud('orders', { action: 'detail', orderId: id })
      this.setData({
        order,
        items: order.items || [],
        customer: order.customer || {},
        paymentStatus: order.paymentStatus || 'unpaid',
        paymentStatusText: order.paymentStatusText || '未收款'
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  handleCollect() {
    wx.showToast({ title: '登记收款', icon: 'none' })
  },

  handlePrint() {
    wx.navigateTo({ url: `/pages/shipping/shipping?orderId=${this.data.order._id}` })
  },

  handleEdit() {
    wx.navigateTo({ url: `/pages/new-order/new-order?id=${this.data.order._id}` })
  },

  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async res => {
        if (res.confirm) {
          try {
            const { callCloud } = require('../../utils/request')
            await callCloud('orders', { action: 'delete', orderId: this.data.order._id })
            wx.showToast({ title: '已删除', icon: 'success' })
            wx.navigateBack()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
