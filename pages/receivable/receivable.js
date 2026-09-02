const { guardPageLoad } = require('../../utils/router-guard')
const tabbarHelper = require('../../utils/tabbar-helper')

const uiStyle = require('../../utils/ui-style')
// T66b 设计token：成功/结清语义色与 app.wxss --theme-success 同值（JS 无法读 CSS var，集中在此防散落硬编码）
const COLOR_SUCCESS = '#16A34A'
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
    collectOrders: [],
    collectOrderIndex: 0,
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
    confirmingPayment: null,

    // 导出预览弹窗（对齐原型 v4.4）
    showExportPreview: false,
    exportPeriod: 'all',
    exportStartDate: '',
    exportEndDate: '',
    previewTotal: 0,
    previewReceived: 0,
    previewUnpaid: 0,
    previewCount: 0,
    exporting: false
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
  },

  onShow() {
    tabbarHelper.refreshCustomTabBar('receivable')
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
      // 账龄分色（对齐原型 AGING_COLOR）：≤30绿 ≤60黄 ≤90橙 >90红
      data.customers = (data.customers || []).map(c => {
        const customer = {
          ...c,
          agingColor: c.maxAge > 90 ? '#DC2626' : c.maxAge >= 90 ? '#EA580C' : c.maxAge >= 60 ? '#F59E0B' : COLOR_SUCCESS
        }
        // 账期分布（对齐原型 buildDebtCards 按月欠款柱状）：按欠款订单的月份分桶
        const monthMap = {}
        ;(c.orders || []).forEach(o => {
          const bal = Number(o.unpaidAmount) || 0
          if (bal <= 0.001 || !o.createdAt) return
          const d = new Date(o.createdAt)
          const key = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1)
          monthMap[key] = { amt: monthMap[key] ? monthMap[key].amt + bal : bal, maxAge: 0, pending: false }
          if (Number(o.debtAgeDays) > monthMap[key].maxAge) monthMap[key].maxAge = Number(o.debtAgeDays)
          if (o.paymentStatus === 'pending') monthMap[key].pending = true
        })
        // 订单行展示（对齐原型：单号/金额/状态/欠款/已收）
        customer.orders = (c.orders || []).map(o => {
          const ps = o.paymentStatus || 'unpaid'
          const bal = Number(o.unpaidAmount) || 0
          // T59-R7B-2（方案A）：结清状态一律按 payment_status——paid=已结清、pending=待确认、其余=未结清。
          // 派生欠款(含待确认)归零时不得判已结清（账务未确认前不结清）。
          const statusText = ps === 'paid' ? '已结清' : (ps === 'pending' ? '待确认' : '未结清')
          const paid = Number(o.paidAmount) || 0
          const amt = Number(o.totalAmount) || 0
          return Object.assign({}, o, {
            statusText, statusPending: ps === 'pending' && bal > 0.001, balText: bal.toFixed(2),
            paidText: paid.toFixed(2), amtText: amt.toFixed(2),
            ageBadge: bal > 0.001 ? ('欠' + (Number(o.debtAgeDays) || 0) + '天') : ''
          })
        })
        // 客户级状态（对齐原型 buildDebtCards：有 pending 单 → 部分结清·待确认）
        // T59-R7B-2（方案A）：客户级状态改按 payment_status——全部订单 paid=已结清；含 pending=待确认；其余=未结清
        customer.hasPending = (c.orders || []).some(o => o.paymentStatus === 'pending')
        const __allPaid = (c.orderCount || 0) > 0 && (c.orders || []).every(o => o.paymentStatus === 'paid')
        customer.statusText = __allPaid ? '已结清' : (customer.hasPending ? '待确认' : '未结清')
        customer.statusColor = __allPaid ? COLOR_SUCCESS : (customer.hasPending ? '#2563EB' : '#DC2626')
        const months = Object.keys(monthMap).sort().map(k => {
          const m = monthMap[k]
          // 颜色：pending 蓝，否则按该月最长账龄分色（对齐原型 agingSeverity）
          let color
          if (m.pending) color = '#2563EB'
          else if (m.maxAge > 90) color = '#DC2626'
          else if (m.maxAge >= 90) color = '#EA580C'
          else if (m.maxAge >= 60) color = '#F59E0B'
          else color = COLOR_SUCCESS
          return { key: k, amt: m.amt.toFixed(2), color, _amt: m.amt }
        })
        const maxAmt = Math.max(1, ...months.map(m => m._amt))
        months.forEach(m => { m.pct = Math.max(8, Math.round(m._amt / maxAmt * 100)); delete m._amt })
        customer.months = months
        return customer
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
    const __pendNote = Number(item.pendingAmount) > 0 ? '（含待确认¥' + item.pendingAmount + '）' : ''
    wx.showModal({
      title: item.name,
      content: `联系人：${item.contact || '-'}\n区域：${item.region || '-'}\n订单数：${item.orderCount}单\n应收：¥${item.totalAmount}\n已收：¥${item.paidAmount}${__pendNote}\n欠款：¥${item.unpaidAmount}`,
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

  // 处理收款（按订单收款，与该客户剩余欠款对齐）
  handleCollect(e) {
    const item = e.currentTarget.dataset.item
    const unpaidOrders = (item.orders || []).filter(o => Number(o.unpaidAmount) > 0)
    const target = unpaidOrders[0] || (item.orders || [])[0]
    this.setData({
      showCollectModal: true,
      collectClientToken: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      collectCustomerName: item.name,
      collectOrders: unpaidOrders.length > 0 ? unpaidOrders : (item.orders || []),
      collectOrderIndex: 0,
      collectOrderNo: target ? target.orderNo : '',
      collectTotalAmount: target ? target.totalAmount : 0,
      collectPaidAmount: target ? target.receivedAmount : 0,
      collectUnpaidAmount: target ? target.unpaidAmount : 0,
      collectAmount: target ? String(Number(target.unpaidAmount).toFixed(2)) : '',
      collectDiscount: '',
      collectNote: '',
      paymentMethodIndex: 0,
      currentCollectItem: item
    })
  },

  // 收款弹窗切换订单
  onCollectOrderChange(e) {
    const idx = Number(e.detail.value)
    const target = this.data.collectOrders[idx]
    if (!target) return
    this.setData({
      collectOrderIndex: idx,
      collectOrderNo: target.orderNo || '',
      collectTotalAmount: target.totalAmount || 0,
      collectPaidAmount: target.receivedAmount || 0,
      collectUnpaidAmount: target.unpaidAmount || 0,
      collectAmount: String(Number(target.unpaidAmount || 0).toFixed(2))
    })
  },

  // 按所选订单待收金额全额收款
  fillCollectAll() {
    const target = this.data.collectOrders[this.data.collectOrderIndex]
    if (!target) return
    this.setData({ collectAmount: String(Number(target.unpaidAmount || 0).toFixed(2)) })
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
    
    const unpaidCents = Math.round(Number(this.data.collectUnpaidAmount || 0) * 100)
    if (Math.round(amount * 100) + Math.round(discount * 100) > unpaidCents) {
      wx.showToast({ 
        title: '收款+折价不能超过该订单欠款 ¥' + (unpaidCents / 100).toFixed(2), 
        icon: 'none' 
      })
      return
    }

    const { callCloud } = require('../../utils/request')
    this.setData({ collectLoading: true })

    try {
      // 收款按所选订单（客户多订单时逐单收款，避免跨单超收）
      const targetOrder = this.data.collectOrders[this.data.collectOrderIndex]
      
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
        discount,
        clientToken: this.data.collectClientToken
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

  // ===== 导出预览弹窗（对齐原型 v4.4：先选周期看汇总，再确认导出）=====
  noop() {},

  openExportPreview() {
    if (!this.data.canExport) {
      wx.showToast({ title: '当前角色无导出权限', icon: 'none' })
      return
    }
    // 自定义周期默认近 30 天
    const d = new Date()
    const p = (n) => (n < 10 ? '0' + n : '' + n)
    const endStr = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    const sd = new Date(d); sd.setDate(d.getDate() - 30)
    const startStr = sd.getFullYear() + '-' + p(sd.getMonth() + 1) + '-' + p(sd.getDate())
    this.setData({
      showExportPreview: true,
      exportPeriod: 'all',
      exportStartDate: startStr,
      exportEndDate: endStr
    })
    this.refreshExportPreview()
  },

  closeExportPreview() {
    if (this.data.exporting) return
    this.setData({ showExportPreview: false })
  },

  onExportPeriod(e) {
    this.setData({ exportPeriod: e.currentTarget.dataset.period }, () => {
      this.refreshExportPreview()
    })
  },

  onExportStartDateChange(e) {
    this.setData({ exportStartDate: e.detail.value }, () => {
      if (this.data.exportPeriod === 'custom') this.refreshExportPreview()
    })
  },

  onExportEndDateChange(e) {
    this.setData({ exportEndDate: e.detail.value }, () => {
      if (this.data.exportPeriod === 'custom') this.refreshExportPreview()
    })
  },

  // 拉取所选周期的聚合数据用于预览汇总
  async refreshExportPreview() {
    const { period, start, end } = this.exportRangeParams()
    if (period === 'custom' && (!start || !end)) return
    try {
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('receivable', {
        action: 'dashboard',
        viewTab: this.data.viewTab,
        timeTab: period,
        searchKey: '',
        startDate: start,
        endDate: end
      })
      this.setData({
        previewTotal: Number(data.totalReceivable || 0).toFixed(2),
        previewReceived: Number(data.totalReceived || 0).toFixed(2),
        previewUnpaid: Number(data.totalUnpaid || 0).toFixed(2),
        previewCount: data.customerCount || 0
      })
    } catch (e) {
      console.error('预览汇总失败', e)
      wx.showToast({ title: '预览汇总失败', icon: 'none' })
    }
  },

  // 解析当前选中的导出周期参数
  exportRangeParams() {
    const period = this.data.exportPeriod
    let start = '', end = ''
    if (period === 'custom') {
      start = this.data.exportStartDate
      end = this.data.exportEndDate
    }
    return { period, start, end }
  },

  // 选择导出格式（默认 Excel，与报表页一致）
  pickExportFormat() {
    return new Promise(resolve => {
      wx.showActionSheet({
        itemList: ['Excel 表格（推荐）', 'CSV 文本'],
        success: res => resolve(res.tapIndex === 0 ? 'excel' : 'csv'),
        fail: () => resolve('excel')
      })
    })
  },

  // 确认导出：按预览弹窗所选周期取数，支持 Excel / CSV 双格式（与预览一致）
  async confirmExport() {
    if (this.data.exporting) return
    const { period, start, end } = this.exportRangeParams()
    if (period === 'custom' && (!start || !end)) {
      wx.showToast({ title: '请选择完整日期范围', icon: 'none' })
      return
    }
    const fmt = await this.pickExportFormat()
    this.setData({ exporting: true })
    try {
      const { callCloud } = require('../../utils/request')
      if (fmt === 'excel') {
        // Excel：云端生成 xlsx 上传云存储，前端下载打开（可转发/保存）
        wx.showLoading({ title: '导出中...' })
        const result = await callCloud('receivable', {
          action: 'exportReceivable',
          viewTab: this.data.viewTab,
          period, start, end,
          format: 'excel'
        })
        wx.hideLoading()
        if (!result || !result.fileID) {
          wx.showToast({ title: '没有可导出的数据', icon: 'none' })
          return
        }
        wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
        wx.showLoading({ title: '打开 Excel...' })
        await new Promise((resolve, reject) => {
          wx.cloud.downloadFile({
            fileID: result.fileID,
            success: d => {
              wx.openDocument({
              filePath: d.tempFilePath,
                showMenu: true,
                fileName: result.filename || 'export.xlsx',
                success: () => resolve(true),
                fail: () => resolve(d.tempFilePath)
              })
            },
            fail: reject
          })
        })
        wx.hideLoading()
        this.setData({ showExportPreview: false })
        wx.showToast({ title: '已打开 Excel，可转发', icon: 'success' })
      } else {
        // CSV：保持本地生成（与预览数据同源 dashboard）
        const data = await callCloud('receivable', {
          action: 'dashboard',
          viewTab: this.data.viewTab,
          timeTab: period,
          searchKey: '',
          startDate: start,
          endDate: end
        })
        this.buildExportCsv(data.customers || [], period, start, end)
      }
    } catch (e) {
      console.error('导出失败', e)
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },

  // 生成并保存赊销报表 CSV（周期参数显式传入，与预览保持一致）
  buildExportCsv(customers, period, start, end) {
    customers = customers || []
    if (!customers.length) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }
    try {
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
      }[period] || period
      
      // 如果是自定义时间，显示具体日期范围
      if (period === 'custom' && start && end) {
        timeLabel = `自定义 (${start} ~ ${end})`
      }
      
      const viewLabel = {
        ledger: '客户台账', unpaid: '未结清', settled: '已结清'
      }[this.data.viewTab] || this.data.viewTab

      const rows = []
      rows.push(['乾多多赊销报表'])
      rows.push(['导出时间：' + new Date().toLocaleString()])
      rows.push(['筛选周期：' + timeLabel + ' · 视图：' + viewLabel])
      rows.push([])
      
      // 口径（A 方案，与看板汇总同口径，折价已正确扣除）：
      //   总欠款(¥)=赊销总额(Σ应收 totalAmount)
      //   已确认收款(¥)=已到账已收(Σ paidAmount = 实收 + 已确认折价，对齐看板/原型)
      //   未收余额(¥)=Σ unpaidAmount，云端已按 max(0, 应收-实收-已确认折价) 计算，永不出现负数
      //   守恒：应收(总欠款) = 已收(实收+已确认折价) + 未收余额
      const custReceivable = (c) => (c.orders || []).reduce((s, o) => s + (o.totalAmount || 0), 0)
      const custConfirmed = (c) => (c.orders || []).reduce((s, o) => s + (o.paidAmount || 0), 0)
      const custBalance = (c) => (c.orders || []).reduce((s, o) => s + (o.unpaidAmount || 0), 0)
      const payText = (ps) => ps === 'paid' ? '已结清' : (ps === 'pending' ? '未结清' : '未付款')

      // 表头：客户、区域、订单数、总欠款(赊销总额)、状态、最长欠款(天)、已确认收款、未收余额
      rows.push(['客户', '区域', '订单数', '总欠款(¥)', '状态', '最长欠款(天)', '已确认收款(¥)', '未收余额(¥)'])

      let grandTotal = 0
      let grandConfirmed = 0
      let grandBalance = 0
      customers.forEach(c => {
        const receivable = custReceivable(c)
        const confirmed = custConfirmed(c)
        const balance = custBalance(c)
        const hasPending = (c.orders || []).some(o => o.paymentStatus === 'pending')
        const status = balance <= 0.001 ? '已结清' : (hasPending ? '部分结清·待确认' : '未结清')
        grandTotal += receivable
        grandConfirmed += confirmed
        grandBalance += balance
        rows.push([
          c.name,
          c.region || '',
          c.orderCount,
          receivable.toFixed(2),
          status,
          c.maxAge > 0 ? c.maxAge : '',
          confirmed.toFixed(2),
          balance.toFixed(2)
        ])
        ;(c.orders || []).forEach(o => {
          const oTotal = o.totalAmount || 0
          const oConfirmed = o.paidAmount || 0
          const oBalance = o.unpaidAmount || 0
          rows.push([
            '  └ ' + o.orderNo,
            '',
            '',
            oTotal.toFixed(2),
            payText(o.paymentStatus),
            oBalance > 0.001 ? (o.debtAgeDays || 0) : '',
            oConfirmed.toFixed(2),
            oBalance.toFixed(2)
          ])
        })
      })

      rows.push([])
      // 合计行
      rows.push(['合计', '', customers.length, grandTotal.toFixed(2), '', '', grandConfirmed.toFixed(2), grandBalance.toFixed(2)])
      // 周期汇总（对齐原型：应收总额/已收/未结清，与合计行同源 grand 值）
      rows.push([])
      rows.push(['周期汇总  应收总额：¥' + grandTotal.toFixed(2) + ' | 已收：¥' + grandConfirmed.toFixed(2) + ' | 未结清：¥' + grandBalance.toFixed(2)])

      const csvContent = rows.map(r => r.map(esc).join(',')).join('\n')
      const filename = '乾多多赊销报表_' + dateStr() + '.csv'
      const filePath = wx.env.USER_DATA_PATH + '/' + filename
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, csvContent, 'utf8')

      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      this.setData({ showExportPreview: false })
      wx.showModal({
        title: '导出成功',
        content: '文件已保存到:\n' + filePath + '\n\n共导出 ' + customers.length + ' 家客户赊销数据，您可通过文件管理工具获取 CSV 文件',
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.showToast({ title: '导出失败', icon: 'none' })
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
  // 阻止点击弹窗内部冒泡（wxml catchtap 引用）
  stopPropagation() {},
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
  },
  // 获取收款方式文本
  getMethodText(method) {
    const map = {
      'cash': '现金',
      'wechat': '微信',
      'alipay': '支付宝',
      'bank': '银行转账'
    }
    return map[method] || '其他'
  }
})
