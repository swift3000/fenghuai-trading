const { guardPageLoad } = require('../../utils/router-guard')
const pricing = require('../../utils/order-pricing')
const { COMPANY_NAME } = require('../../constants/index.js')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    companyName: COMPANY_NAME,
    order: null,
    noOrder: false,
    items: [],
    orderDate: '',
    
    // 打印预览弹窗
    showPreviewModal: false,
    printLoading: false
  },

  onLoad(options) {
    uiStyle.applyUiStyle(this)
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
    const user = (app.globalData && app.globalData.userInfo) || {}
    this.setData({
      userPhone: user.phone || ''
    })
    if (options.orderId) {
      this.loadOrder(options.orderId)
    } else {
      this.setData({ noOrder: true })
    }
  },

  // 加载订单数据
  async loadOrder(id) {
    try {
      this.setData({ loading: true })
      const { callCloud } = require('../../utils/request')
      const result = await callCloud('orders', {
        action: 'detail',
        orderId: id
      })
      
      const order = result
      // 销售日期：从 created_at 推导（修复 orderDate 未定义导致的空显示）
      const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('zh-CN') : ''
      const rawItems = (order.items || [])
        .filter(it => (it.piece_qty || 0) > 0 || ((it.package_qty != null ? it.package_qty : (it.zero_qty || 0)) > 0))
        .map(it => Object.assign({}, it, {
          qtyDesc: pricing.formatQtyCombined(it),
          amount: it.amount != null ? it.amount : pricing.calcItemAmount(it),
          price: it.price != null ? it.price : (it.price_piece || it.price_unit || it.price_zero || 0),
          unit: pricing.getUnitByMode(it, 'piece')
        }))
      const items = rawItems.map(it => {
        const pq = it.piece_qty || 0
        const zq = (it.package_qty != null ? it.package_qty : (it.zero_qty || 0))
        return Object.assign({}, it, {
          qty: Math.max(pq, zq),
          remark: it.remark || '',
          priceText: it.price != null ? pricing.fmtMoney(it.price) : '',
          amountText: it.amount != null ? pricing.fmtMoney(it.amount) : ''
        })
      })
      const totalQty = items.reduce((sum, it) => {
        const pq = it.piece_qty || 0
        const zq = (it.package_qty != null ? it.package_qty : (it.zero_qty || 0))
        return sum + pq + zq
      }, 0)
      let grandTotal = 0
      items.forEach(it => { grandTotal += it.amount })
      grandTotal = Number(grandTotal || 0)
      const totalDebt = order.totalDebt != null ? Number(order.totalDebt) : 0

      this.setData({
        order,
        companyName: order.customerName || COMPANY_NAME,
        items,
        orderDate,
        totalQty,
        grandTotal,
        totalDebt,
        grandTotalCN: pricing.numberToChinese(grandTotal),
        shipAmountText: pricing.fmtMoney(grandTotal),
        totalDebtCN: pricing.numberToChinese(totalDebt),
        totalDebtText: pricing.fmtMoney(totalDebt),
        loading: false
      })
    } catch (e) {
      console.error('加载订单失败', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 打印送货单
  handlePrint() {
    if (!this.data.order) {
      wx.showToast({ title: '请先加载订单', icon: 'none' })
      return
    }
    this.setData({ showPreviewModal: true })
  },

  // 选择导出格式（默认 Excel）
  pickExportFormat() {
    return new Promise(resolve => {
      wx.showActionSheet({
        itemList: ['Excel 表格（推荐）', 'CSV 文本'],
        success: res => resolve(res.tapIndex === 0 ? 'excel' : 'csv'),
        fail: () => resolve('excel')
      })
    })
  },

  // 保存导出文件：excel 下载云文件并打开（可转发/保存），csv 写本地文件
  saveExportFile(result, fmt) {
    if (fmt === 'excel' && result && result.fileID) {
      return new Promise((resolve, reject) => {
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
    }
    if (result && result.csvContent) {
      const fn = result.filename || ('export_' + Date.now() + '.csv')
      const filePath = wx.env.USER_DATA_PATH + '/' + fn
      wx.getFileSystemManager().writeFileSync(filePath, result.csvContent, 'utf8')
      return Promise.resolve(filePath)
    }
    return Promise.resolve(null)
  },

  // 导出Excel（对齐原型 exportSingleOrder，复用现有云函数 action）
  async handleExportExcel() {
    const order = this.data.order
    if (!order) { wx.showToast({ title: '暂无订单数据', icon: 'none' }); return }
    const fmt = await this.pickExportFormat()
    try {
      wx.showLoading({ title: '导出中...' })
      const { callCloud } = require('../../utils/request')
      const result = await callCloud('orders', {
        action: 'exportSingleOrder',
        orderId: order._id || order.id,
        format: fmt
      })
      const hasData = fmt === 'excel' ? !!(result && result.fileID) : !!(result && result.csvContent)
      if (!hasData) { wx.hideLoading(); wx.showToast({ title: '导出失败', icon: 'none' }); return }
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      if (fmt === 'excel') {
        await this.saveExportFile(result, 'excel')
        wx.hideLoading()
        wx.showToast({ title: '已打开 Excel，可转发', icon: 'success' })
        return
      }
      const filePath = await this.saveExportFile(result, 'csv')
      wx.hideLoading()
      wx.showModal({ title: '导出成功', content: '文件已保存到: \n' + filePath, showCancel: false })
    } catch (e) {
      console.error('导出失败', e)
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  // 返回列表
  handleBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 关闭预览弹窗
  closePreviewModal() {
    this.setData({ showPreviewModal: false })
  },

  // 确认打印：云函数生成送货单 PDF → 打开（系统菜单可打印/转发/保存）
  async confirmPrint() {
    if (this.data.printLoading) return
    this.setData({ printLoading: true })
    try {
      wx.showLoading({ title: '正在生成送货单...' })
      const { callCloud } = require('../../utils/request')
      const order = this.data.order || {}
      const result = await callCloud('orders', {
        action: 'printOrder',
        orderId: order._id || order.id
      })
      wx.hideLoading()
      if (!result || !result.fileID) {
        wx.showToast({ title: '生成失败', icon: 'none' })
        return
      }
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      wx.showLoading({ title: '打开 PDF...' })
      await new Promise((resolve, reject) => {
        wx.cloud.downloadFile({
          fileID: result.fileID,
          success: d => {
            wx.openDocument({
            filePath: d.tempFilePath,
              showMenu: true,
              fileName: result.filename || '送货单.pdf',
              success: resolve,
              fail: resolve
            })
          },
          fail: reject
        })
      })
      wx.hideLoading()
      this.closePreviewModal()
      wx.showToast({ title: '已打开，右上角可打印/转发', icon: 'none' })
    } catch (e) {
      console.error('打印失败', e)
      wx.hideLoading()
      wx.showModal({
        title: '打印提示',
        content: '送货单生成失败，请重试。也可到订单详情用「导出Excel」生成表格打印。',
        showCancel: false
      })
    } finally {
      this.setData({ printLoading: false })
    }
  },


  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
