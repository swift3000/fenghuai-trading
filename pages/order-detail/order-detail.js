const pricing = require('../../utils/order-pricing')

// 为一行商品生成合并数量文案（2件+10包）
function qtyDesc(it) {
  return pricing.formatQtyCombined(it)
}

Page({
  data: {
    order: null,
    items: [],
    customer: null,
    paymentStatus: '',
    paymentStatusText: '',
    showCollectModal: false,
    collectAmount: '',
    collectNote: '',
    paymentMethods: ['现金', '微信', '支付宝', '银行转账'],
    paymentMethodIndex: 0,
    collectLoading: false
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
      const paymentStatus = order.payment_status || order.paymentStatus || 'unpaid'
      const rawItems = (order.items || []).map(it => Object.assign({}, it, {
        qtyDesc: qtyDesc(it)
      }))
      this.setData({
        order,
        items: rawItems,
        customer: order.customer || {},
        paymentStatus,
        paymentStatusText: paymentStatus === 'paid' ? '已收款' : (paymentStatus === 'pending' ? '待确认' : '未收款')
      })
    } catch (e) {
      console.error('加载失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  handleCollect() {
    this.setData({ showCollectModal: true })
  },

  closeCollectModal() {
    this.setData({ showCollectModal: false })
  },

  onCollectAmountChange(e) {
    this.setData({ collectAmount: e.detail.value })
  },

  onCollectNoteChange(e) {
    this.setData({ collectNote: e.detail.value })
  },

  onPaymentMethodChange(e) {
    this.setData({ paymentMethodIndex: e.detail.value })
  },

  async confirmCollect() {
    const amount = parseFloat(this.data.collectAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入正确的收款金额', icon: 'none' })
      return
    }
    const received = this.data.order.received_amount || this.data.order.receivedAmount || 0
    const remaining = Math.max(0, this.data.order.totalAmount - received)
    if (amount > remaining) {
      wx.showToast({ title: `收款金额不能超过剩余欠款 ¥${remaining}`, icon: 'none' })
      return
    }

    this.setData({ collectLoading: true })
    try {
      const { callCloud } = require('../../utils/request')
      const paymentMethod = this.data.paymentMethods[this.data.paymentMethodIndex]
      await callCloud('receivable', {
        action: 'collect',
        orderId: this.data.order._id,
        amount,
        paymentMethod,
        note: this.data.collectNote
      })
      wx.showToast({ title: '已登记收款，待库管确认', icon: 'success' })
      this.setData({ 
        showCollectModal: false, 
        collectAmount: '',
        collectNote: '',
        collectLoading: false
      })
      this.loadOrderDetail(this.data.order._id)
    } catch (e) {
      console.error('收款失败', e)
      wx.showToast({ title: '收款失败', icon: 'none' })
      this.setData({ collectLoading: false })
    }
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
