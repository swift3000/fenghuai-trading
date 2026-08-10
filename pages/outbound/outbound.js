Page({
  data: { subTab: 'sort', pendingSort: [], doneSort: [], pendingOut: [], doneOut: [] },
  onShow() { this.loadData() },
  switchSub(e) { this.setData({ subTab: e.currentTarget.dataset.tab }); this.loadData() },
  async loadData() {
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('orders', { action: 'outboundList', subTab: this.data.subTab })
      this.setData({ ...data })
    } catch (e) { console.log(e) }
  },
  handleSort(e) { wx.showToast({ title: '分拣确认', icon: 'none' }) },
  handleOut(e) { wx.showToast({ title: '出库确认', icon: 'none' }) },
  handleAllSort() { wx.showToast({ title: '全部分拣', icon: 'none' }) },
  handleAllOut() { wx.showToast({ title: '全部出库', icon: 'none' }) }
})
