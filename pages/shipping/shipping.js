const { guardPageLoad } = require('../../utils/router-guard')
const pricing = require('../../utils/order-pricing')
const { COMPANY_NAME } = require('../../constants/index.js')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    companyName: COMPANY_NAME,
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

  // 生成打印内容（HTML 格式，对齐原型「销售单」）
  generatePrintContent() {
    const { order, items, orderDate, grandTotal, totalQty, shipAmountText, grandTotalCN, totalDebtText, userPhone } = this.data

    const rows = (items || []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align:left">${item.name}</td>
        <td style="text-align:left">${item.spec || ''}</td>
        <td>${item.unit || '件'}</td>
        <td>${item.qtyDesc}</td>
        <td>${item.price != null ? item.price : ''}</td>
        <td style="text-align:right">${item.amountText != null ? item.amountText : item.amount}</td>
        <td style="text-align:left">${item.remark || ''}</td>
      </tr>`).join('')

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: '宋体', SimSun, Arial, sans-serif; padding: 20px; }
          .title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .meta { margin-bottom: 8px; font-size: 13px; }
          .customer { font-size: 14px; margin-bottom: 12px; font-weight: 600; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          .table th, .table td { border: 1px solid #333; padding: 6px 8px; text-align: center; font-size: 13px; }
          .table th { background: #f5f5f5; font-weight: bold; }
          .total-row td { font-weight: bold; background: #f9f9f9; }
          .summary { font-size: 14px; font-weight: 600; margin: 6px 0; display: flex; justify-content: space-between; }
          .debt { font-size: 14px; font-weight: bold; color: #c0392b; margin: 6px 0; }
          .footinfo { display: flex; justify-content: space-between; margin-top: 18px; border-top: 1px solid #eee; padding-top: 12px; font-size: 13px; line-height: 2; }
          .note { font-size: 12px; color: #888; margin-top: 12px; border-top: 1px dashed #ddd; padding-top: 8px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="title">${COMPANY_NAME}食品销售单</div>
        <div class="meta">单号：${order.orderNo}</div>
        <div class="meta">销售日期：${orderDate}</div>
        <div class="customer">客户：${order.customerName}${order.customerPhone ? '（' + order.customerPhone + '）' : ''}</div>

        <table class="table">
          <thead>
            <tr><th>编号</th><th>产品</th><th>规格型号</th><th>单位</th><th>总数量</th><th>单价</th><th>金额</th><th>备注</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td></td><td colspan="3" style="text-align:left">合计</td><td>${totalQty}</td><td></td><td style="text-align:right">${shipAmountText}</td><td></td>
            </tr>
          </tbody>
        </table>

        <div class="summary">
          <span>产品合计：${shipAmountText}　送货金额：${shipAmountText}</span>
          <span>合计金额：${grandTotalCN} ${shipAmountText}</span>
        </div>
        <div class="debt">累计欠款：${totalDebtText}</div>

        <div class="footinfo">
          <div>
            <div>订货电话：${order.customerPhone || ''}</div>
            <div>订货地址：${order.customerAddress || ''}</div>
            <div>主营业务：速冻面点，火锅丸子，单位团餐，酒店食材</div>
          </div>
          <div style="text-align:right">
            <div>制单人：${userPhone || ''}</div>
            <div>收货人(签字)：__________</div>
          </div>
        </div>
        <div class="note">注：收到货后，请仔细查看储存说明，冷冻食品属特殊商品，如非产品本身质量问题、日期问题，一经售出，概不退换，谢谢合作！</div>
      </body>
      </html>
    `

    return html
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
