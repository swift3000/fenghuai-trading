Page({
  data: { searchKey: '', products: [] },
  onShow() { this.loadProducts() },
  onSearch(e) { this.setData({ searchKey: e.detail.value }); this.loadProducts() },
  async loadProducts() {
    try {
      const { callCloud } = require('../../utils/request')
      const products = await callCloud('products', { action: 'list', searchKey: this.data.searchKey })
      this.setData({ products: products || [] })
    } catch (e) { console.log(e) }
  },
  goToAdd() { this.setData({ showForm: true, editingProduct: null }) },
  goEdit(e) { this.setData({ showForm: true, editingProduct: e.currentTarget.dataset.item }) },
  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '确认删除', success: async res => {
      if (res.confirm) {
        try {
          const { callCloud } = require('../../utils/request')
          await callCloud('products', { action: 'delete', productId: id })
          this.loadProducts()
        } catch (e) { wx.showToast({ title: '删除失败', icon: 'none' }) }
      }
    }})
  },
  onFormSubmit(e) {
    this.setData({ showForm: false })
    this.loadProducts()
  },
  onCloseForm() { this.setData({ showForm: false }) }
})
