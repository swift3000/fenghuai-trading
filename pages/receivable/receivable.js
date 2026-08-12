const { guardPageLoad } = require('../../utils/router-guard')

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
    customers: [],
    
    // 收款弹窗
    showCollectModal: false,
    collectCustomerName: '',
    collectOrderNo: '',
    collectTotalAmount: 0,
    collectPaidAmount: 0,
    collectUnpaidAmount: 0,
    collectAmount: '',
    collectNote: '',
    collectLoading: false,
    paymentMethods: ['现金', '微信', '支付宝', '银行转账', '其他'],
    paymentMethodIndex: 0,
    currentCollectItem: null
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },

  onShow() {
    this.loadData()
  },

  // 切换视图
  switchView(e) {
    const viewTab = e.currentTarget.dataset.tab
    this.setData({ 
      viewTab,
      searchKey: '',
      customers: []
    })
    this.loadData()
  },

  // 切换时间范围
  switchTime(e) {
    const timeTab = e.currentTarget.dataset.key
    this.setData({ timeTab })
    this.loadData()
  },

  // 搜索
  onSearch(e) {
    this.setData({ searchKey: e.detail.value })
    // 防抖处理
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }
    this.searchTimer = setTimeout(() => {
      this.loadData()
    }, 300)
  },

  // 加载数据
  async loadData() {
    try {
      this.setData({ loading: true })
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('receivable', {
        action: 'dashboard',
        viewTab: this.data.viewTab,
        timeTab: this.data.timeTab,
        searchKey: this.data.searchKey
      })
      this.setData({ ...data, loading: false })
    } catch (e) {
      console.error('加载数据失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 查看客户详情
  viewCustomerDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: item.name,
      content: `联系人：${item.contact || '-'}\n区域：${item.region || '-'}\n订单数：${item.orderCount}单\n应收：¥${item.totalAmount}\n已收：¥${item.paidAmount}\n欠款：¥${item.unpaidAmount}`,
      showCancel: false
    })
  },

  // 拨打电话
  callPhone(e) {
    const phone = e.currentTarget.dataset.phone
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => wx.showToast({ title: '拨打失败', icon: 'none' })
    })
  },

  // 处理收款
  handleCollect(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showCollectModal: true,
      collectCustomerName: item.name,
      collectOrderNo: item.orders && item.orders.length > 0 ? item.orders[0].orderNo : '多个订单',
      collectTotalAmount: item.totalAmount,
      collectPaidAmount: item.paidAmount,
      collectUnpaidAmount: item.unpaidAmount,
      collectAmount: '',
      collectNote: '',
      paymentMethodIndex: 0,
      currentCollectItem: item
    })
  },

  // 关闭收款弹窗
  closeCollectModal() {
    this.setData({
      showCollectModal: false,
      currentCollectItem: null
    })
  },

  // 收款金额输入
  onCollectAmountChange(e) {
    this.setData({
      collectAmount: e.detail.value
    })
  },

  // 收款方式选择
  onPaymentMethodChange(e) {
    this.setData({
      paymentMethodIndex: e.detail.value
    })
  },

  // 备注输入
  onCollectNoteChange(e) {
    this.setData({
      collectNote: e.detail.value
    })
  },

  // 确认收款
  async confirmCollect() {
    const amount = parseFloat(this.data.collectAmount)
    
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    
    if (amount > this.data.collectUnpaidAmount) {
      wx.showToast({ 
        title: `收款金额不能超过欠款 ¥${this.data.collectUnpaidAmount}`, 
        icon: 'none' 
      })
      return
    }

    const { callCloud } = require('../../utils/request')
    this.setData({ collectLoading: true })

    try {
      // 获取当前选中的订单（如果有多个订单，先收第一个）
      const orders = this.data.currentCollectItem.orders || []
      const targetOrder = orders.find(o => o.unpaidAmount > 0) || orders[0]
      
      if (!targetOrder) {
        wx.showToast({ title: '没有可收款的订单', icon: 'none' })
        this.setData({ collectLoading: false })
        return
      }

      await callCloud('receivable', {
        action: 'collect',
        orderId: targetOrder._id,
        amount: amount,
        paymentMethod: this.data.paymentMethods[this.data.paymentMethodIndex],
        note: this.data.collectNote
      })

      wx.showToast({ title: '收款成功', icon: 'success' })
      this.closeCollectModal()
      this.loadData()
    } catch (e) {
      console.error('收款失败', e)
      wx.showToast({ title: e.message || '收款失败', icon: 'none' })
    } finally {
      this.setData({ collectLoading: false })
    }
  },

  // 导出赊销报表 CSV（复用页面已聚合数据）
  handleExport() {
    const customers = this.data.customers || []
    if (!customers.length) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }
    try {
      wx.showLoading({ title: '导出中...' })
      const esc = (v) => {
        const s = (v === null || v === undefined) ? '' : String(v)
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const dateStr = () => {
        const d = new Date()
        const p = (n) => (n < 10 ? '0' + n : '' + n)
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      }
      const timeLabel = {
        all: '全部', today: '今日', week: '本周', month: '本月'
      }[this.data.timeTab] || this.data.timeTab
      const viewLabel = {
        ledger: '客户台账', unpaid: '未结清', settled: '已结清'
      }[this.data.viewTab] || this.data.viewTab

      const rows = []
      rows.push(['丰淮商贸赊销报表'])
      rows.push(['导出时间：' + new Date().toLocaleString()])
      rows.push(['视图：' + viewLabel + ' · 周期：' + timeLabel + (this.data.searchKey ? ' · 搜索:' + this.data.searchKey : '')])
      rows.push([])
      const totalReceivable = customers.reduce((s, c) => s + (c.totalAmount || 0), 0)
      const totalReceived = customers.reduce((s, c) => s + (c.paidAmount || 0), 0)
      const totalUnpaid = customers.reduce((s, c) => s + (c.unpaidAmount || 0), 0)
      rows.push(['应收总额：' + totalReceivable.toFixed(2) + ' | 已收：' + totalReceived.toFixed(2) + ' | 未结清：' + totalUnpaid.toFixed(2)])
      rows.push([])
      rows.push(['客户', '区域', '订单数', '应收(¥)', '已收(¥)', '欠款(¥)'])

      customers.forEach(c => {
        rows.push([
          c.name,
          c.region || '',
          c.orderCount,
          (c.totalAmount || 0).toFixed(2),
          (c.paidAmount || 0).toFixed(2),
          (c.unpaidAmount || 0).toFixed(2)
        ])
        ;(c.orders || []).forEach(o => {
          rows.push([
            '  └ ' + o.orderNo,
            '',
            '',
            (o.totalAmount || 0).toFixed(2),
            (o.paidAmount || 0).toFixed(2),
            (o.unpaidAmount || 0).toFixed(2)
          ])
        })
      })

      rows.push([])
      rows.push(['合计', '', customers.length, totalReceivable.toFixed(2), totalReceived.toFixed(2), totalUnpaid.toFixed(2)])

      const csvContent = rows.map(r => r.map(esc).join(',')).join('\n')
      const filename = '丰淮商贸赊销报表_' + dateStr() + '.csv'
      const filePath = wx.env.USER_DATA_PATH + '/' + filename
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, csvContent, 'utf8')

      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      wx.showToast({ title: '已导出到临时目录', icon: 'success' })
      wx.showModal({
        title: '导出成功',
        content: '文件已保存到:\n' + filePath + '\n\n共导出 ' + customers.length + ' 家客户赊销数据，您可通过文件管理工具获取 CSV 文件',
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
