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
      pending: '邀请中',
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

  // 生成带角色的邀请码（调用后端 auth/getInviteCode，自动创建待激活用户）
  async handleInvite() {
    wx.showLoading({ title: '生成中...' })
    try {
      const { inviteRole, inviteRoleLabel } = this.data
      const data = await callCloud('auth', { action: 'getInviteCode', role: inviteRole })
      const inviteCode = data && data.inviteCode
      const expireTime = data && data.expireTime
      if (!inviteCode) {
        throw new Error('未返回邀请码')
      }
      // 有效期提示（后端返回 Date 对象，可能为 ISO 字符串）
      const expireText = expireTime
        ? ('有效期至 ' + new Date(expireTime).toLocaleDateString())
        : '7 天内有效'
      wx.showModal({
        title: '邀请码已生成',
        content: `角色：${inviteRoleLabel}\n邀请码：${inviteCode}\n${expireText}\n\n将邀请码发给员工，员工在登录页填写后即可自动绑定该角色。`,
        confirmText: '复制邀请码',
        cancelText: '关闭',
        success: res => {
          if (res.confirm) {
            wx.setClipboardData({ data: inviteCode })
          }
        }
      })
      this.loadMembers()
    } catch (e) {
      // callCloud 内部已 toast 错误信息
      if (!e || e.code === undefined) {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 复制某成员（待激活）的邀请码
  copyInvite(e) {
    const code = e.currentTarget.dataset.code
    if (!code) {
      wx.showToast({ title: '该成员无邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: code })
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
