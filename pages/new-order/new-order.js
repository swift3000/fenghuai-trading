Page({
  data: {
    customer: null,
    items: [],
    totalAmount: 0,
    showCustomerModal: false,
    showProductModal: false,
    showSmartInput: false
  },

  onLoad(options) {
    if (options.id) {
      this.loadOrder(options.id)
    }
  },

  loadOrder(id) {
    console.log('加载订单', id)
  },

  selectCustomer() {
    this.setData({ showCustomerModal: true })
  },

  confirmCustomer(e) {
    this.setData({
      customer: e.detail,
      showCustomerModal: false
    })
  },

  addProduct() {
    this.setData({ showProductModal: true })
  },

  confirmProduct(e) {
    const items = this.data.items
    items.push(e.detail)
    this.calcTotal()
    this.setData({ items, showProductModal: false })
  },

  removeItem(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.items
    items.splice(index, 1)
    this.calcTotal()
    this.setData({ items })
  },

  calcTotal() {
    let total = 0
    this.data.items.forEach(item => {
      total += (item.price || 0) * (item.qty || 0)
    })
    this.setData({ totalAmount: total })
  },

  openSmartInput() {
    this.setData({ showSmartInput: true })
  },

  async saveOrder() {
    if (!this.data.customer) {
      wx.showToast({ title: '请选择客户', icon: 'none' })
      return
    }
    if (!this.data.items.length) {
      wx.showToast({ title: '请添加商品', icon: 'none' })
      return
    }
    if (this.data.totalAmount <= 0) {
      wx.showToast({ title: '订单金额不能为0', icon: 'none' })
      return
    }
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'create',
        customerId: this.data.customer._id,
        customerName: this.data.customer.name,
        items: this.data.items,
        totalAmount: this.data.totalAmount
      })
      wx.showToast({ title: '订单已创建', icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  }
})
