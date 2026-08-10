Page({
  data: { searchKey: '', customers: [] },
  onShow() { this.loadCustomers() },
  onSearch(e) { this.setData({ searchKey: e.detail.value }); this.loadCustomers() },
  async loadCustomers() {
    try {
      const { callCloud } = require('../../utils/request')
      const customers = await callCloud('customers', { action: 'list', searchKey: this.data.searchKey })
      this.setData({ customers: customers || [] })
    } catch (e) { console.log(e) }
  },
  goToAdd() { this.setData({ showForm: true, editingCustomer: null }) },
  goEdit(e) { this.setData({ showForm: true, editingCustomer: e.currentTarget.dataset.item }) },
  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '确认删除', success: async res => {
      if (res.confirm) {
        try {
          const { callCloud } = require('../../utils/request')
          await callCloud('customers', { action: 'delete', customerId: id })
          this.loadCustomers()
        } catch (e) { wx.showToast({ title: '删除失败', icon: 'none' }) }
      }
    }})
  },
  onFormSubmit(e) { this.setData({ showForm: false }); this.loadCustomers() },
  onCloseForm() { this.setData({ showForm: false }) }
})
