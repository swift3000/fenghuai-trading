Page({
  data: { members: [], inviteRole: 'orderer' },
  onShow() { this.loadMembers() },
  async loadMembers() {
    try {
      const { callCloud } = require('../../utils/request')
      const members = await callCloud('users', { action: 'list' })
      this.setData({ members: members || [] })
    } catch (e) { console.log(e) }
  },
  changeInviteRole(e) { this.setData({ inviteRole: e.detail.value }) },
  handleInvite() { wx.showToast({ title: '生成邀请码', icon: 'none' }) },
  handleRemove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '确认移除', success: async res => {
      if (res.confirm) {
        try {
          const { callCloud } = require('../../utils/request')
          await callCloud('users', { action: 'remove', userId: id })
          this.loadMembers()
        } catch (e) { wx.showToast({ title: '移除失败', icon: 'none' }) }
      }
    }})
  }
})
