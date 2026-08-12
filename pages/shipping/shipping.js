const { guardPageLoad } = require('../../utils/router-guard')

Page({
  data: {
    order: null,
    items: [],
    orderDate: '',
    
    // 打印预览弹窗
    showPreviewModal: false,
    printCopies: 1,
    paperSize: 'A4 (210mm × 297mm)',
    printers: ['系统默认打印机', '蓝牙打印机 A', '蓝牙打印机 B'],
    printerIndex: 0,
    printLoading: false
  },

  onLoad(options) {
    if (!guardPageLoad(this)) {
      return
    }
    if (options.orderId) {
      this.loadOrder(options.orderId)
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
      const items = order.items || []
      // 兼容两种字段命名：received_amount（权威）/ paidAmount
      if (order.received_amount !== undefined && order.paidAmount === undefined) {
        order.receivedAmount = order.received_amount
        order.paidAmount = order.received_amount
        order.unpaidAmount = Math.max(0, (order.totalAmount || 0) - order.received_amount)
      } else if (order.receivedAmount !== undefined) {
        order.paidAmount = order.receivedAmount
        order.unpaidAmount = Math.max(0, (order.totalAmount || 0) - order.receivedAmount)
      }
      // 格式化日期
      const createdAt = order.created_at
      let orderDate = ''
      if (createdAt) {
        const date = new Date(createdAt)
        orderDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
      
      this.setData({
        order,
        items,
        orderDate,
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

  // 打印预览
  handlePreview() {
    this.setData({ showPreviewModal: true })
  },

  // 返回列表
  handleBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 关闭预览弹窗
  closePreviewModal() {
    this.setData({ showPreviewModal: false })
  },

  // 打印份数输入
  onPrintCopiesChange(e) {
    let copies = parseInt(e.detail.value) || 1
    if (copies < 1) copies = 1
    if (copies > 99) copies = 99
    this.setData({ printCopies: copies })
  },

  // 打印机选择
  onPrinterChange(e) {
    this.setData({ printerIndex: e.detail.value })
  },

  // 确认打印
  async confirmPrint() {
    this.setData({ printLoading: true })
    
    try {
      // 生成打印内容
      const printContent = this.generatePrintContent()
      
      // 调用打印 API
      const res = await wx.createUserPrintTask({
        fileName: `sales_invoice_${this.data.order.orderNo}.pdf`,
        content: printContent
      })
      
      if (res.statusCode === 200) {
        wx.showToast({ 
          title: `已打印 ${this.data.printCopies} 份`, 
          icon: 'success' 
        })
        this.closePreviewModal()
      } else {
        throw new Error('打印失败')
      }
    } catch (e) {
      console.error('打印失败', e)
      // 降级方案：生成图片预览
      wx.showModal({
        title: '打印提示',
        content: '当前设备不支持直接打印，您可以截图或导出 PDF 后打印',
        showCancel: false
      })
    } finally {
      this.setData({ printLoading: false })
    }
  },

  // 生成打印内容（HTML 格式）
  generatePrintContent() {
    const { order, items, orderDate } = this.data
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; }
          .subtitle { font-size: 14px; color: #666; }
          .info-section { margin-bottom: 20px; }
          .info-row { margin-bottom: 8px; }
          .label { font-weight: bold; margin-right: 10px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background: #f5f5f5; }
          .total-section { margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .footer { margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">丰淮商贸销售单</div>
          <div class="subtitle">SALES INVOICE</div>
        </div>
        
        <div class="info-section">
          <div class="info-row">单号：${order.orderNo}</div>
          <div class="info-row">日期：${orderDate}</div>
          <div class="info-row">客户：${order.customerName}</div>
          <div class="info-row">区域：${order.customerRegion || '-'}</div>
          <div class="info-row">联系人：${order.customerContact || '-'}</div>
          <div class="info-row">电话：${order.customerPhone || '-'}</div>
        </div>
        
        <table class="table">
          <thead>
            <tr>
              <th>商品名称</th>
              <th>规格</th>
              <th>数量</th>
              <th>单价</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.spec || '-'}</td>
                <td>${item.qty}</td>
                <td>¥${item.price}</td>
                <td>¥${item.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row">
            <span>合计:</span>
            <span>¥${order.totalAmount}</span>
          </div>
          ${order.paidAmount > 0 ? `<div class="total-row"><span>已收款:</span><span style="color: green;">¥${order.paidAmount}</span></div>` : ''}
          ${order.unpaidAmount > 0 ? `<div class="total-row"><span>欠款:</span><span style="color: red;">¥${order.unpaidAmount}</span></div>` : ''}
        </div>
        
        <div class="footer">
          <div>备注：${order.note || '无'}</div>
          <div style="margin-top: 20px;">制单人：${order.createdBy || '系统'}</div>
        </div>
      </body>
      </html>
    `
    
    return html
  },

  // 导出 Excel（预留功能）
  handleExport() {
    wx.showToast({ title: '导出功能开发中', icon: 'none' })
  }
})
