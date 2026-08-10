Page({
  data: {
    viewTab: 'ledger',
    timeTab: 'all',
    searchKey: '',
    totalReceivable: 0,
    totalReceived: 0,
    totalUnpaid: 0,
    customerCount: 0,
    settledCount: 0,
    customers: []
  },
  onShow() { this.loadData() },
  switchView(e) { this.setData({ viewTab: e.currentTarget.dataset.tab }); this.loadData() },
  switchTime(e) { this.setData({ timeTab: e.currentTarget.dataset.key }); this.loadData() },
  onSearch(e) { this.setData({ searchKey: e.detail.value }); this.loadData() },
  async loadData() {
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('receivable', { action: 'dashboard', viewTab: this.data.viewTab, timeTab: this.data.timeTab, searchKey: this.data.searchKey })
      this.setData({ ...data })
    } catch (e) { console.log(e) }
  },
  handleCollect(e) { wx.showToast({ title: '登记收款', icon: 'none' }) },
  handleConfirm(e) { wx.showToast({ title: '确认收款', icon: 'none' }) },
  handleExport() { wx.showToast({ title: '导出CSV', icon: 'none' }) }
})
