const app = getApp()
const { callCloud } = require('../../utils/request')
const { guardPageLoad } = require('../../utils/router-guard')
const { PERM_GROUPS, PERM_LABELS, PERM_LOCKED, ROLE_ORDER, ROLE_LABELS, DEFAULT_MATRIX } = require('../../utils/perm-matrix')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    members: [],
    // 按角色分组（对齐原型 renderMembers：组头=角色标签+N人+添加成员）
    roleGroups: [],
    roleColorMap: { orderer: '#67C23A', sorter: '#F8A44C', warehouse: '#409EFF', admin: '#F56C6C' },
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
      disabled: '禁用',
      inactive: '禁用'
    },
    roleIndex: 0,
    inviteRoleLabel: '下单员',
    inviteQr: '',
    lastInvite: null,
    // 添加成员弹窗（对齐原型二级 memberFormModal）
    showMemberForm: false,
    addMemberRole: 'orderer',
    addMemberRoleLabel: '下单员',
    addMemberName: '',
    addMemberOpenid: '',
    addMemberPhone: '',
    // 权限配置折叠（对齐原型三级 sec-head collapsible）
    permCollapsed: false,
    // 权限矩阵
    roleCols: ROLE_ORDER.map(r => ({ role: r, label: ROLE_LABELS[r] })),
    permGroups: [],
    permLoading: false
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    this.loadMembers()
    if (app.globalData && app.globalData.userInfo && app.globalData.userInfo.role === 'admin') {
      this.loadPermConfig()
    }
  },

  async loadMembers() {
    wx.showLoading({ title: '加载中...' })
    try {
      const members = await callCloud('users', { action: 'list' })
      // WXML 不能调用页面方法，这里预格式化加入日期（serverDate 可能为 {\$date} 对象）
      const list = (members || []).map(m => Object.assign({}, m, {
        dateText: this.formatDate(m.createdAt),
        initial: (m.name || '?').charAt(0),
        subText: (m.openid ? m.openid : '微信 openid') + ' · ' + (m.phone || '未填手机'),
        pending: m.status === 'pending'
      }))
      // 按角色分组（原型顺序：下单员/分拣员/库管/管理员）
      const groups = ROLE_ORDER.map(role => {
        const items = list.filter(m => m.role === role)
        return { role, label: this.data.roleMap[role], color: this.data.roleColorMap[role], count: items.length, items }
      })
      this.setData({
        members: list,
        roleGroups: groups,
        roleIndex: this.data.roleOptions.findIndex(r => r.value === this.data.inviteRole)
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ members: [], roleGroups: [] })
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

  // ===== 添加成员弹窗（对齐原型二级 memberFormModal） =====
  openMemberForm(e) {
    const role = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.role) || 'orderer'
    this.setData({
      showMemberForm: true,
      addMemberRole: role,
      addMemberRoleLabel: this.data.roleMap[role] || '下单员',
      addMemberName: '',
      addMemberOpenid: '',
      addMemberPhone: ''
    })
  },

  onAddMemberField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  changeAddMemberRole(e) {
    const value = e.detail.value
    const label = this.data.roleOptions.find(r => r.value === value)?.label || value
    this.setData({ addMemberRole: value, addMemberRoleLabel: label })
  },

  closeMemberForm() {
    this.setData({ showMemberForm: false })
  },

  submitMemberForm() {
    const name = (this.data.addMemberName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入成员姓名', icon: 'none' })
      return
    }
    wx.showLoading({ title: '添加中...' })
    callCloud('users', {
      action: 'add',
      name,
      role: this.data.addMemberRole,
      openid: (this.data.addMemberOpenid || '').trim(),
      phone: (this.data.addMemberPhone || '').trim()
    }).then(() => {
      wx.showToast({ title: '已添加成员', icon: 'success' })
      this.closeMemberForm()
      this.loadMembers()
    }).catch(e => {
      wx.showToast({ title: (e && e.message) || '添加失败', icon: 'none' })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  // 权限配置折叠（对齐原型 togglePermSection）
  togglePermSection() {
    this.setData({ permCollapsed: !this.data.permCollapsed })
  },

  // 弹窗遮罩阻止冒泡占位
  noop() {},

  // 生成带角色的邀请码 + 二维码（调用后端 auth/getInviteCode，自动创建待激活用户）
  async handleInvite() {
    wx.showLoading({ title: '生成中...' })
    try {
      const { inviteRole, inviteRoleLabel } = this.data
      const data = await callCloud('auth', { action: 'getInviteCode', role: inviteRole })
      const inviteCode = data && data.inviteCode
      const qrFileID = data && data.inviteQr
      const expireTime = data && data.inviteExpire
      if (!inviteCode) {
        throw new Error('未返回邀请码')
      }
      const expireText = expireTime
        ? ('有效期至 ' + new Date(expireTime).toLocaleDateString())
        : '7 天内有效'
      // 展示邀请卡片（二维码为主，邀请码文本兜底）
      this.setData({
        inviteQr: qrFileID || '',
        lastInvite: {
          code: inviteCode,
          roleLabel: inviteRoleLabel,
          expireText
        }
      })
      this.loadMembers()
    } catch (e) {
      if (!e || e.code === undefined) {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 复制邀请码
  copyInvite(e) {
    const code = e.currentTarget.dataset.code
    if (!code) {
      wx.showToast({ title: '该成员无邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: code })
  },

  // 复制当前生成的邀请码
  copyLastInvite() {
    const inv = this.data.lastInvite
    if (inv && inv.code) {
      wx.setClipboardData({ data: inv.code })
    }
  },

  closeInvite() {
    this.setData({ inviteQr: '', lastInvite: null })
  },

  // T44：转发邀请小程序卡片。对方点开卡片直达登录页，邀请码自动填入并绑定角色。
  onShareAppMessage() {
    const inv = this.data.lastInvite
    if (inv && inv.code) {
      return {
        title: '钱多多 · 邀请你加入（' + inv.roleLabel + '）',
        path: '/pages/login/login?invite=' + inv.code
      }
    }
    return {
      title: '钱多多采购下单助手',
      path: '/pages/login/login'
    }
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

  // ===== 角色权限配置（权限矩阵） =====

  // 加载各角色实际权限并渲染矩阵
  async loadPermConfig() {
    try {
      const result = await callCloud('users', { action: 'perm-config' })
      if (!result) return
      const rolePerms = result // { admin: [keys], orderer: [...], ... }
      const groups = PERM_GROUPS.map(g => {
        const rows = g.keys.map(key => {
          const locked = !!PERM_LOCKED[key]
          const cells = ROLE_ORDER.map(r => ({
            on: !!(rolePerms[r] && rolePerms[r].includes(key)),
            disabled: locked
          }))
          return { key, label: PERM_LABELS[key] || key, locked, cells }
        })
        return { name: g.name, count: g.keys.length, rows }
      })
      this.setData({ permGroups: groups, permLoading: false })
    } catch (e) {
      this.setData({ permLoading: false })
      wx.showToast({ title: '权限配置加载失败', icon: 'none' })
    }
  },

  // 切换某角色某权限开关（点击某格）
  async togglePerm(e) {
    const { group, row, role } = e.currentTarget.dataset
    const rowIdx = Number(row)
    const roleIdx = Number(role)
    const grp = this.data.permGroups[Number(group)]
    if (!grp) return
    const r = grp.rows[rowIdx]
    if (!r || r.locked) return   // 锁定项不可改
    const target = r.cells[roleIdx]
    if (!target) return
    const roleName = ROLE_ORDER[roleIdx]
    const newOn = !target.on

    // 乐观更新
    const cells = r.cells.map((c, i) => (i === roleIdx ? { ...c, on: newOn } : c))
    const newGroups = this.data.permGroups.map((g, gi) => (gi === Number(group)
      ? { ...g, rows: g.rows.map((rr, ri) => (ri === rowIdx ? { ...rr, cells } : rr)) }
      : g))
    this.setData({ permGroups: newGroups })

    try {
      wx.showLoading({ title: '保存中...' })
      // 计算该角色当前勾选的完整权限数组
      const perms = []
      this.data.permGroups.forEach(g => g.rows.forEach(rr => {
        rr.cells.forEach((c, ci) => {
          if (ci === roleIdx && c.on) perms.push(rr.key)
        })
      }))
      await callCloud('users', { action: 'save-perm', role: roleName, permissions: perms })
      wx.showToast({ title: newOn ? '已开启' : '已关闭', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      // 回滚
      const rollCells = r.cells.map((c, i) => (i === roleIdx ? { ...c, on: target.on } : c))
      const rollGroups = this.data.permGroups.map((g, gi) => (gi === Number(group)
        ? { ...g, rows: g.rows.map((rr, ri) => (ri === rowIdx ? { ...rr, cells: rollCells } : rr)) }
        : g))
      this.setData({ permGroups: rollGroups })
    } finally {
      wx.hideLoading()
    }
  },

  // 恢复默认（全员开放）
  async resetPerms() {
    const saved = this.data.permGroups
    wx.showModal({
      title: '恢复默认',
      content: '确认将所有角色权限恢复为「全员开放」默认？（成员管理仍仅管理员）',
      success: async res => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '恢复中...' })
          await Promise.all(ROLE_ORDER.map(r => callCloud('users', { action: 'reset-perm', role: r })))
          wx.showToast({ title: '已恢复默认' })
          // 用默认矩阵重建渲染
          const groups = PERM_GROUPS.map(g => {
            const rows = g.keys.map(key => {
              const locked = !!PERM_LOCKED[key]
              const cells = ROLE_ORDER.map(r => ({
                on: !!(PERM_LOCKED[key] ? (r === 'admin') : (DEFAULT_MATRIX[key] && DEFAULT_MATRIX[key][r])),
                disabled: locked
              }))
              return { key, label: PERM_LABELS[key] || key, locked, cells }
            })
            return { name: g.name, count: g.keys.length, rows }
          })
          this.setData({ permGroups: groups })
        } catch (e) {
          this.setData({ permGroups: saved })
          wx.showToast({ title: '恢复失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  formatDate(date) {
    let d = date
    if (d && typeof d === 'object') d = d['\u0024date'] || d.date || d
    if (!d) return '-'
    d = new Date(d)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
