const app = getApp()
const { callCloud } = require('../../utils/request')
const { guardPageLoad } = require('../../utils/router-guard')

Page({
  data: {
    members: [],
    inviteRole: 'orderer',
    roleOptions: [
      { label: '下单员', value: 'orderer' },
      { label: '分拣员', value: 'sorter' },
      { label: '库管', value: 'warehouse' },
      { label: '管理员', value: 'admin' }
    ],
    roleMap: {
      admin: '管理员',
      orderer: '下单员',
      sorter: '分拣员',
      warehouse: '库管'
    },
    statusMap: {
      active: '正常',
      inactive: '禁用'
    },
    roleIndex: 0,
    inviteRoleLabel: '下单员'
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },

  onShow() {
    this.loadMembers()
  },

  async loadMembers() {
    wx.showLoading({ title: '加载中...' })
    try {
      const members = await callCloud('users', { action: 'list' })
      this.setData({ 
        members: members || [],
        roleIndex: this.data.roleOptions.findIndex(r => r.value === this.data.inviteRole)
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  changeInviteRole(e) {
    const value = e.detail.value
    const label = this.data.roleOptions.find(r => r.value === value)?.label || value
    this.setData({ 
      inviteRole: value,
      inviteRoleLabel: label
    })
  },

  async changeRole(e) {
    const userId = e.currentTarget.dataset.id
    const newRole = e.detail.value
    const roleLabel = this.data.roleOptions.find(r => r.value === newRole)?.label || newRole
    
    try {
      wx.showLoading({ title: '更新中...' })
      await callCloud('users', { 
        action: 'update-role', 
        userId, 
        role: newRole 
      })
      wx.showToast({ title: '角色已更新' })
      this.loadMembers()
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  handleInvite() {
    wx.showToast({ 
      title: '邀请码生成中', 
      icon: 'none',
      duration: 2000
    })
  },

  handleRemove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认移除',
      content: '移除后该成员将无法访问系统',
      success: async res => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '移除中...' })
            await callCloud('users', { action: 'remove', userId: id })
            wx.showToast({ title: '已移除' })
            this.loadMembers()
          } catch (e) {
            wx.showToast({ title: '移除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  formatDate(date) {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
})
