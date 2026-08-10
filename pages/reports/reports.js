Page({
  data: { reportTab: 'product', timeTab: 'day', data: [] },
  onShow() { this.loadData() },
  switchTab(e) { this.setData({ reportTab: e.currentTarget.dataset.tab }); this.loadData() },
  switchTime(e) { this.setData({ timeTab: e.currentTarget.dataset.key }); this.loadData() },
  async loadData() {
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('report', { action: 'summary', reportTab: this.data.reportTab, timeTab: this.data.timeTab })
      this.setData({ data: data || [] })
    } catch (e) { console.log(e) }
  },
  handleExport() { wx.showToast({ title: '导出报表', icon: 'none' }) }
})
