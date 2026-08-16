const { COMPANY_NAME } = require('../../constants/index.js')
const pricing = require('../../utils/order-pricing')
const { ORDER_STATUS_TEXT } = require('../../constants/index.js')

// 为一行商品生成合并数量文案（2件+10包）
function qtyDesc(it) {
  return pricing.formatQtyCombined(it)
}

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    order: null,
    items: [],
    customer: null,
    paymentStatus: '',
    paymentStatusText: '',
    showCollectModal: false,
    collectAmount: '',
    collectNote: '',
    paymentMethods: ['现金', '微信', '支付宝', '银行转账'],
    paymentMethodIndex: 0,
    collectLoading: false,
    canPrint: false,
    canEdit: false,
    editEnabled: false,
    canDelete: false,
    canCollect: false,
    canExport: false,
    canDiscount: false,
    collectDiscount: '',
    receivedAmount: 0,
    totalDiscount: 0,
    remainingDebt: 0,
    creatorText: '',
    shareCardReady: false,
    shareTempFilePath: '',
    logs: []
  },

  onLoad(options) {
    uiStyle.applyUiStyle(this);
    const app = getApp();
    const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || [];
    this.setData({
      canPrint: perms.includes('order:print'),
      canEdit: perms.includes('order:edit'),
      canDelete: perms.includes('order:delete'),
      canCollect: perms.includes('receivable:collect'),
      canExport: perms.includes('order:export'),
      canDiscount: perms.includes('receivable:discount')
    });
    if (options.id) {
      this.loadOrderDetail(options.id);
    }
  },

  async loadOrderDetail(id) {
    try {
      console.log('========================================');
      console.log('🔍 开始加载订单详情');
      console.log('   订单 ID:', id);
      console.log('========================================');
      wx.showLoading({ title: '加载中...', mask: true });
      
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('orders', { action: 'detail', orderId: id, id })
      console.log('📡 云函数调用完成');
      console.log('📦 原始返回数据:', JSON.stringify(res, null, 2));
      console.log('res.result:', res.result);
      console.log('res.data:', res.data);
      
      // 处理返回数据
      
      // callCloud 已经解包了数据，res 就是订单数据本身
      const order = res || {};
      
      console.log('📋 处理后的 order 对象:');
      console.log('   order._id:', order ? order._id : 'NULL');
      console.log('   order.id:', order ? order.id : 'NULL');
      console.log('   order.orderNo:', order ? order.orderNo : 'NULL');
      console.log('   order.items:', order && order.items ? order.items.length : 'NULL');
      console.log('   order.customerName:', order ? order.customerName : 'NULL');
      
      console.log('🔎 验证订单数据...');
      console.log('   order 对象:', order);
      console.log('   order._id:', order ? order._id : 'undefined');
      
      if (!order) {
        console.error('❌ 订单数据为空');
        wx.hideLoading();
        wx.showToast({ title: '订单数据为空', icon: 'none' });
        return;
      }
      
      if (!order._id && !order.id) {
        console.error('❌ 订单 ID 缺失:', order);
        wx.hideLoading();
        wx.showToast({ title: '订单 ID 缺失，数据格式错误', icon: 'none' });
        console.log('   完整数据:', JSON.stringify(order, null, 2));
        return;
      }
      
      console.log('✅ 订单数据验证通过');
      console.log('   订单号:', order.orderNo);
      console.log('   客户:', order.customerName);
      console.log('   金额:', order.totalAmount);
      
      const paymentStatus = order.payment_status || order.paymentStatus || 'unpaid'
      const rawItems = (order.items || []).map(it => Object.assign({}, it, {
        qtyDesc: qtyDesc(it)
      }))
      // 操作记录（对齐原型 renderOrderLogs）：无则生成默认创建记录
      const roleLabels = {
        orderer: '下单员', sorter: '分拣员', warehouse: '库管', admin: '管理员', system: '系统'
      }
      let logs = (order.logs || []).map(l => Object.assign({}, l, {
        roleLabel: roleLabels[l.role] || l.role || '',
        timeText: l.time ? new Date(l.time).toLocaleString('zh-CN') : ''
      }))
      if (!logs.length) {
        logs = [{
          action: 'create',
          desc: '创建订单',
          operatorName: order.createdByName || '未知',
          roleLabel: '',
          timeText: order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : ''
        }]
      }
      // 倒序展示（最新在上）
      logs = logs.slice().reverse()
      // 转发时间文案（WXML 不支持 new Date 表达式）
      const sharedAtText = order.shared_at ? new Date(order.shared_at).toLocaleString('zh-CN') : ''
      // 收款三行：已收金额 / 折价货损 / 剩余欠款（对齐原型 detailPaySection）
      const totalAmount = Number(order.totalAmount || order.total_amount || 0)
      const received = Number(order.received_amount != null ? order.received_amount : (order.receivedAmount || 0))
      const discount = Number(order.total_discount != null ? order.total_discount : (order.totalDiscount || 0))
      const remaining = Math.max(0, totalAmount - received - discount)
      const creatorText = '下单员：' + (order.createdByName || order.created_by_name || '未知')
      const orderTimeText = order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '—'
      console.log('💾 准备设置页面数据...');
      console.log('   订单:', order.orderNo);
      console.log('   商品数量:', rawItems.length);
      console.log('   客户:', order.customerName);
      
      this.setData({
        order,
        sharedAtText,
        items: rawItems,
        customer: order.customer || {},
        paymentStatus,
        paymentStatusText: paymentStatus === 'paid' ? '已收款' : (paymentStatus === 'pending' ? '待确认' : '未收款'),
        orderStatusText: (ORDER_STATUS_TEXT[order.status] || order.status || '未知'),
        receivedAmount: received,
        totalDiscount: discount,
        remainingDebt: remaining,
        creatorText,
        orderTimeText,
        logs,
        editEnabled: ['submitted', 'sorted', 'rejected'].includes(order.status)
      })
    } catch (e) {
      console.error('❌ 加载订单详情失败:', e);
      console.error('   错误堆栈:', e.stack);
      wx.hideLoading();
      wx.showToast({ 
        title: '加载失败：' + (e.message || '未知错误'), 
        icon: 'none',
        duration: 3000
      });
    } finally {
      wx.hideLoading();
      console.log('========================================');
      console.log('🏁 加载订单详情结束');
      console.log('========================================');
    }
  },

  handleCollect() {
    this.setData({ showCollectModal: true, collectDiscount: '' })
  },

  closeCollectModal() {
    this.setData({ showCollectModal: false })
  },

  onCollectAmountChange(e) {
    this.setData({ collectAmount: e.detail.value })
  },

  onCollectNoteChange(e) {
    this.setData({ collectNote: e.detail.value })
  },

  onCollectDiscountChange(e) {
    this.setData({ collectDiscount: e.detail.value })
  },

  onPaymentMethodChange(e) {
    this.setData({ paymentMethodIndex: e.detail.value })
  },

  async confirmCollect() {
    const amount = parseFloat(this.data.collectAmount)
    const discount = parseFloat(this.data.collectDiscount) || 0
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入正确的收款金额', icon: 'none' })
      return
    }
    if (discount < 0) {
      wx.showToast({ title: '折价不能为负数', icon: 'none' })
      return
    }
    const total = Number(this.data.order.totalAmount || 0)
    const received = Number(this.data.order.received_amount != null ? this.data.order.received_amount : (this.data.order.receivedAmount || 0))
    const existingDiscount = Number(this.data.order.total_discount != null ? this.data.order.total_discount : (this.data.order.totalDiscount || 0))
    const remaining = Math.max(0, total - received - existingDiscount)
    if (amount + discount > remaining) {
      wx.showToast({ title: `收款+折价不能超过剩余欠款 ¥${remaining}`, icon: 'none' })
      return
    }
    if (discount > 0 && !this.data.canDiscount) {
      wx.showToast({ title: '无折价/减免权限', icon: 'none' })
      return
    }

    this.setData({ collectLoading: true })
    try {
      const { callCloud } = require('../../utils/request')
      const paymentMethod = this.data.paymentMethods[this.data.paymentMethodIndex]
      await callCloud('receivable', {
        action: 'collect',
        orderId: this.data.order._id,
        amount,
        paymentMethod,
        note: this.data.collectNote,
        discount
      })
      wx.showToast({ title: '已登记收款，待库管确认', icon: 'success' })
      this.setData({ 
        showCollectModal: false, 
        collectAmount: '',
        collectNote: '',
        collectLoading: false
      })
      this.loadOrderDetail(this.data.order._id)
    } catch (e) {
      console.error('收款失败', e)
      wx.showToast({ title: '收款失败', icon: 'none' })
      this.setData({ collectLoading: false })
    }
  },

  handlePrint() {
    wx.navigateTo({ url: `/pages/shipping/shipping?orderId=${this.data.order._id}` })
  },

  handleEdit() {
    wx.navigateTo({ url: `/pages/new-order/new-order?id=${this.data.order._id}` })
  },

  // 转发客户微信（对齐原型：发送「销售单」卡片给客户微信）
  // 微信转发只能带封面图，此处用 canvas 绘制销售单卡片作为转发图片
  onForwardTap() {
    this.drawSalesCard(() => {
      // 绘制完成后引导用户通过右上角菜单转发
      wx.showModal({
        title: '转发销售单',
        content: '销售单卡片已生成，请点击右上角「...」选择「转发给朋友」发送给客户微信。',
        showCancel: false
      })
    })
  },

  // 绘制销售单卡片图（对齐原型 forward 模式紧凑卡片）
  drawSalesCard(cb) {
    const order = this.data.order || {}
    const ctx = wx.createCanvasContext('salesCardCanvas', this)
    const W = 500
    // 高度根据明细行数动态计算
    const rows = this.data.items.length || 1
    const H = 420 + rows * 34 + 80
    // 顶部标题
    ctx.setFillStyle('#c0392b')
    ctx.fillRect(0, 0, W, 8)
    ctx.setFillStyle('#222')
    ctx.setFontSize(24)
    ctx.setTextAlign('center')
    ctx.fillText(`${order.customerName || COMPANY_NAME}食品销售单`, W / 2, 44)
    ctx.setFontSize(13)
    ctx.setFillStyle('#888')
    ctx.fillText(`${order.orderNo || ''}`, W / 2, 66)
    ctx.setTextAlign('left')
    // 客户
    ctx.setFillStyle('#c0392b')
    ctx.setFontSize(18)
    ctx.fillText(`客户：${order.customerName || ''}`, 22, 100)

    // 表头
    let y = 124
    ctx.setFillStyle('#f5f5f5')
    ctx.fillRect(22, y - 22, W - 44, 26)
    ctx.setFillStyle('#333')
    ctx.setFontSize(13)
    const cols = [
      { x: 22, w: 150, t: '产品' },
      { x: 172, w: 90, t: '规格' },
      { x: 262, w: 60, t: '数量', align: 'center' },
      { x: 322, w: 70, t: '单价', align: 'right' },
      { x: 392, w: 86, t: '金额', align: 'right' }
    ]
    cols.forEach(c => {
      ctx.setTextAlign(c.align || 'left')
      ctx.fillText(c.t, c.align === 'right' ? c.x + c.w : c.x, y)
    })
    ctx.setTextAlign('left')
    y += 8
    // 明细行
    this.data.items.forEach(it => {
      y += 34
      ctx.setFillStyle('#333')
      ctx.setFontSize(13)
      ctx.fillText(it.name || '', 22, y)
      ctx.fillText(it.spec || '-', 172, y)
      ctx.setTextAlign('center')
      ctx.fillText(it.qtyDesc || '', 292, y)
      ctx.setTextAlign('right')
      ctx.fillText(pricing.fmtMoney(it.price || 0), 322 + 70, y)
      ctx.fillText(pricing.fmtMoney(it.amount || 0), 392 + 86, y)
      ctx.setTextAlign('left')
    })

    // 合计行
    y += 40
    ctx.setFillStyle('#fef9f5')
    ctx.fillRect(22, y - 22, W - 44, 26)
    ctx.setFillStyle('#c0392b')
    ctx.setFontSize(15)
    const total = Number(order.totalAmount || 0)
    ctx.fillText(`合计金额：${pricing.numberToChinese(total)}  ¥${pricing.fmtMoney(total)}`, 22, y)

    // 累计欠款
    y += 34
    ctx.setFontSize(14)
    ctx.setFillStyle('#e74c3c')
    const debt = this.data.order.totalDebt != null ? Number(this.data.order.totalDebt) : 0
    ctx.fillText(`累计欠款：¥${pricing.fmtMoney(debt)}`, 22, y)

    // 底部提示
    ctx.setFontSize(11)
    ctx.setFillStyle('#999')
    ctx.setTextAlign('right')
    ctx.fillText('冷冻食品非质量问题概不退换', W - 22, H - 18)

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'salesCardCanvas',
        x: 0, y: 0, width: W, height: H,
        destWidth: W, destHeight: H,
        success: res => {
          this.setData({ shareTempFilePath: res.tempFilePath, shareCardReady: true })
          if (cb) cb(res.tempFilePath)
        },
        fail: err => {
          console.error('生成销售单卡片失败', err)
          if (cb) cb('')
        }
      }, this)
    })
  },

  onShareAppMessage() {
    const order = this.data.order || {}
    const orderId = order._id || order.id

    // 若销售单卡片已生成，用它作为转发封面
    const imageUrl = this.data.shareTempFilePath || ''

    // 记录转发状态
    if (orderId) {
      const { callCloud } = require('../../utils/request')
      callCloud('orders', {
        action: 'markShared',
        orderId: orderId
      }).catch(e => console.error('记录转发状态失败', e))
    }

    return {
      title: `「${order.customerName || COMPANY_NAME}食品销售单」${order.orderNo || ''} · ¥${order.totalAmount || ''}`,
      path: orderId ? `/pages/order-detail/order-detail?id=${orderId}` : '/pages/orders/orders',
      imageUrl: imageUrl || undefined
    }
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

  // 保存导出文件：excel 下载云文件并打开（右上角可转发/保存），csv 写本地文件
  saveExportFile(result, fmt) {
    if (fmt === 'excel' && result && result.fileID) {
      return new Promise((resolve, reject) => {
        wx.downloadFile({
          url: result.fileID,
          success: d => {
            if (d.statusCode !== 200) return reject(new Error('download fail'))
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

  // 导出订单送货单（对齐原型 exportSingleOrder），支持 Excel / CSV
  async handleExportExcel() {
    const order = this.data.order || {}
    if (!order.orderNo) {
      wx.showToast({ title: '暂无订单数据', icon: 'none' })
      return
    }
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
      if (!hasData) {
        wx.hideLoading()
        wx.showToast({ title: '导出失败', icon: 'none' })
        return
      }
      wx.showShareMenu({ withShareTicket: true, shareTypes: [1, 2] })
      if (fmt === 'excel') {
        wx.hideLoading()
        wx.showLoading({ title: '打开 Excel...' })
        await this.saveExportFile(result, 'excel')
        wx.hideLoading()
        wx.showToast({ title: '已打开 Excel，可转发', icon: 'success' })
        return
      }
      const filePath = await this.saveExportFile(result, 'csv')
      wx.hideLoading()
      wx.showToast({ title: '已导出 CSV', icon: 'success' })
      wx.showModal({
        title: '导出成功',
        content: '文件已保存到:\n' + filePath,
        showCancel: false
      })
    } catch (e) {
      console.error('导出失败', e)
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },


  // 复制订单（对齐原型 copyOrder：复制订单信息到剪贴板）
  handleCopyOrder() {
    const order = this.data.order || {}
    const text = `订单号：${order.orderNo || ''}\n客户：${order.customerName || ''}\n金额：¥${Number(order.totalAmount || 0).toFixed(2)}`
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '订单信息已复制', icon: 'success' })
    })
  },

  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async res => {
        if (res.confirm) {
          try {
            const { callCloud } = require('../../utils/request')
            await callCloud('orders', { action: 'delete', orderId: this.data.order._id })
            wx.showToast({ title: '已删除', icon: 'success' })
            wx.navigateBack()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
