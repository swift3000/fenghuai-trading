const { guardPageLoad } = require('../../utils/router-guard')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
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
    collectDiscount: '',
    collectNote: '',
    collectLoading: false,
    paymentMethods: ['现金', '微信', '支付宝', '银行转账', '其他'],
    paymentMethodIndex: 0,
    currentCollectItem: null,
    
    // 自定义日期范围
    startDate: '' ,
    endDate: '' ,
    
    // 收款确认工作台
    canConfirmPayment: false,
    canCollect: false,
    canDiscount: false,
    canExport: false,
    pendingPaymentCount: 0,
    showConfirmWorkbench: false,
    pendingPayments: [],
    confirmingPayment: null 
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    this.checkPaymentConfirmPermission()
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
      collectDiscount: '',
      collectNote: '',
      paymentMethodIndex: 0,
      currentCollectItem: item
    })
  },

  // 关闭收款弹窗
  closeCollectModal() {
    this.setData({
      showCollectModal: false,
      currentCollectItem: null,
    })
  },

  // 收款金额输入
  onCollectAmountChange(e) {
    this.setData({
      collectAmount: e.detail.value
    })
  },

  // 折价/货损输入
  onCollectDiscountChange(e) {
    this.setData({
      collectDiscount: e.detail.value
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
    const discount = parseFloat(this.data.collectDiscount) || 0
    
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    
    if (discount < 0) {
      wx.showToast({ title: '折价不能为负数', icon: 'none' })
      return
    }
    
    if (amount + discount > this.data.collectUnpaidAmount) {
      wx.showToast({ 
        title: `收款+折价不能超过欠款 ¥${this.data.collectUnpaidAmount}`, 
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
        note: this.data.collectNote,
        discount: this.data.canDiscount ? discount : 0
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
        let s = (v === null || v === undefined) ? '' : String(v)
        // 防 CSV 公式注入：Excel 打开时将 = + - @ 开头单元格前缀 ' 转文本
        if (/^[=+\-@]/.test(s)) s = "'" + s
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const dateStr = () => {
        const d = new Date()
        const p = (n) => (n < 10 ? '0' + n : '' + n)
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      }
      
      // 时间标签（包含自定义）
      let timeLabel = {
        all: '全部', today: '今日', week: '本周', month: '本月', custom: '自定义'
      }[this.data.timeTab] || this.data.timeTab
      
      // 如果是自定义时间，显示具体日期范围
      if (this.data.timeTab === 'custom' && this.data.startDate && this.data.endDate) {
        timeLabel = `自定义 (${this.data.startDate} ~ ${this.data.endDate})`
      }
      
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
      
      // 汇总行：应收 / 已收 / 未结清 三项
      rows.push(['汇总：应收=' + totalReceivable.toFixed(2) + ' | 已收=' + totalReceived.toFixed(2) + ' | 未结清=' + totalUnpaid.toFixed(2)])
      rows.push([])
      
      // 表头：客户、区域、订单数、应收、已收、未结清
      rows.push(['客户', '区域', '订单数', '应收(¥)', '已收(¥)', '未结清(¥)', '收款状态'])

      customers.forEach(c => {
        rows.push([
          c.name,
          c.region || '',
          c.orderCount,
          (c.totalAmount || 0).toFixed(2),
          (c.paidAmount || 0).toFixed(2),
          (c.unpaidAmount || 0).toFixed(2),
          ''
        ])
        ;(c.orders || []).forEach(o => {
          // 收款状态映射
          let paymentStatusText = '未收款'
          if (o.paymentStatus === 'pending') paymentStatusText = '待确认'
          else if (o.paymentStatus === 'paid') paymentStatusText = '已收款'
          
          rows.push([
            '  └ ' + o.orderNo,
            '',
            '',
            (o.totalAmount || 0).toFixed(2),
            (o.receivedAmount || 0).toFixed(2),
            (o.unpaidAmount || 0).toFixed(2),
            paymentStatusText
          ])
        })
      })

      rows.push([])
      // 合计行
      rows.push(['合计', '', customers.length, totalReceivable.toFixed(2), totalReceived.toFixed(2), totalUnpaid.toFixed(2), ''])

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
  },
  // 自定义日期处理
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },

  applyCustomDate() {
    if (!this.data.startDate || !this.data.endDate) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' })
      return
    }
    
    // 验证日期范围
    const start = new Date(this.data.startDate)
    const end = new Date(this.data.endDate)
    if (start > end) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }
    
    wx.showToast({ title: '已应用筛选', icon: 'success' })
    this.loadData()
  },

  // 检查是否有收款确认权限
  async checkPaymentConfirmPermission() {
    try {
      const app = getApp()
      const userInfo = (app && app.globalData && app.globalData.userInfo) || {}
      const perms = userInfo.permissions || []
      const canConfirm = perms.includes('receivable:confirm')
      this.setData({
        canConfirmPayment: canConfirm,
        canCollect: perms.includes('receivable:collect'),
        canDiscount: perms.includes('receivable:discount'),
        canExport: perms.includes('report:export')
      })
      
      if (canConfirm) {
        await this.loadPendingPayments()
      }
    } catch (e) {
      console.error('检查权限失败', e)
    }
  },

  // 加载待确认收款列表
  async loadPendingPayments() {
    try {
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('receivable', { action: 'pendingConfirm' })
      const payments = res || [] // callCloud 已解包 data，直接取数组
      this.setData({ 
        pendingPayments: payments,
        pendingPaymentCount: payments.length
      })
    } catch (e) {
      console.error('加载待确认收款失败', e)
    }
  },

  // 显示收款确认工作台
  showConfirmWorkbench() {
    this.setData({ showConfirmWorkbench: true })
  },

  // 关闭工作台
  closeConfirmWorkbench() {
    this.setData({ showConfirmWorkbench: false })
  },

  // 确认收款
  async confirmPayment(e) {
    const paymentId = e.currentTarget.dataset.id
    if (!paymentId) return
    
    wx.showModal({
      title: '确认收款',
      content: '确定确认这笔收款吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ confirmingPayment: paymentId })
            const { callCloud } = require('../../utils/request')
            await callCloud('receivable', {
              action: 'confirmPayment',
              paymentId
            })
            wx.showToast({ title: '收款已确认', icon: 'success' })
            this.setData({ confirmingPayment: null })
            await this.loadPendingPayments()
            await this.loadData() // 刷新台账数据
          } catch (e) {
            console.error('确认收款失败', e)
            wx.showToast({ title: '确认失败', icon: 'none' })
            this.setData({ confirmingPayment: null })
          }
        }
      }
    })
  }
,
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})