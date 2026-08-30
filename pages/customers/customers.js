const { guardPageLoad } = require('../../utils/router-guard')
const { callCloud } = require('../../utils/request')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    searchKeyword: '',
    customers: [],
    customerGroups: [],
    canEdit: false,
  isAdmin: false,
    showForm: false,
    editingCustomer: null,
    saving: false,
    formData: {
      name: '',
      alias: '',
      region: '',
      phone: '',
      contact: ''
    }
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    this.setData({ canEdit: perms.includes('customer:edit') })
    this.setData({ isAdmin: (app.globalData.userInfo && app.globalData.userInfo.role === "admin") || false })
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    this.loadCustomers()
  },

  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.loadCustomers()
  },

  async loadCustomers() {
    wx.showLoading({ title: '加载中...' })
    try {
      const customers = await callCloud('customers', {
        action: 'list',
        searchKey: this.data.searchKeyword
      })
      this.setData({ customers: customers || [], customerGroups: this.groupByRegion(customers || []) })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  groupByRegion(list) {
    const map = {}
    const order = []
    ;(list || []).forEach(c => {
      const r = c.region || '未分籋'
      if (!map[r]) { map[r] = []; order.push(r) }
      map[r].push(c)
    })
    return order.map(r => ({ region: r, items: map[r] }))
  },


  goToAdd() {
    this.setData({
      showForm: true,
      editingCustomer: null,
      formData: {
        name: '',
        alias: '',
        region: '',
        phone: '',
        contact: ''
      }
    })
  },

  goEdit(e) {
    const item = e.currentTarget.dataset.item
    
    this.setData({
      showForm: true,
      editingCustomer: item,
      formData: {
        name: item.name || '',
        alias: item.alias || '',
        region: item.region || '',
        phone: item.phone || '',
        contact: item.contact || ''
      }
    })
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: async res => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            await callCloud('customers', { action: 'delete', customerId: id })
            wx.showToast({ title: '已删除' })
            this.loadCustomers()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  closeForm() {
    this.setData({
      showForm: false,
      editingCustomer: null
    })
  },

  async saveCustomer() {
    const { formData, editingCustomer } = this.data

    // 表单验证
    if (!formData.name) {
      wx.showToast({ title: '请输入客户名称', icon: 'none' })
      return
    }
    if (!formData.region) {
      wx.showToast({ title: '请输入区域', icon: 'none' })
      return
    }

    const customerData = {
      name: formData.name,
      alias: formData.alias,
      region: formData.region,
      phone: formData.phone,
      contact: formData.contact
    }

    try {
      this.setData({ saving: true })
      wx.showLoading({ title: editingCustomer ? '更新中...' : '创建中...' })

      if (editingCustomer) {
        // 更新
        await callCloud('customers', {
          action: 'update',
          customerId: editingCustomer._id,
          ...customerData
        })
        wx.showToast({ title: '更新成功' })
      } else {
        // 创建
        await callCloud('customers', {
          action: 'create',
          ...customerData
        })
        wx.showToast({ title: '创建成功' })
      }

      this.setData({ showForm: false, saving: false })
      this.loadCustomers()
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      this.setData({ saving: false })
    } finally {
      wx.hideLoading()
    }
  },

 onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
