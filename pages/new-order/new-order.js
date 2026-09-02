const pricing = require('../../utils/order-pricing')
const { guardPageLoad } = require('../../utils/router-guard')

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    uiStyle: '',
    customer: null,
    items: [],
    totalAmount: '0.00',
    showCustomerModal: false,
    showProductModal: false,
    showSmartModal: false,
    customerList: [],
    productList: [],
    displayCustomers: [],
    displayProducts: [],
    customerSearchKeyword: '',
    customerDebounceTimer: null,
    productSearchKeyword: '',
    productDebounceTimer: null,
    smartInputText: '',
    smartInputLoading: false,
    smartPreviewItems: [],
    editMode: false,
    voiceState: 'idle', // idle | recording | transcribing
    smartTab: 'text' // 智能录入弹窗 tab：text 文字 / voice 语音（对齐原型）
  },

  onLoad(options) {
    uiStyle.applyUiStyle(this)
    if (!guardPageLoad(this)) {
      return
    }
    if (options.id) {
      this.loadOrder(options.id)
    }
    this.loadCustomers()
    this.loadProducts()
    // 首页智能录入入口：自动打开智能录入弹窗
    if (options && options.smart === '1') {
      // 首页悬浮球入口：直达语音 tab（对齐原型 openSmartFabVoice）
      this.setData({ showSmartModal: true, smartTab: 'voice' })
    }
  },

  async loadCustomers() {
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('customers', { action: 'list' })
      const customerList = res && res.data ? res.data : (res || [])
      this.setData({ customerList, displayCustomers: customerList })
      this.refreshCustomers()
      wx.hideLoading();
    } catch (e) {
      console.error('加载客户失败', e)
      wx.hideLoading();
      wx.showToast({ title: '加载客户失败', icon: 'none' })
      this.setData({ customerList: [], displayCustomers: [] })
    }
  },

  async loadProducts() {
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('products', { action: 'list' })
      const productList = res && res.data ? res.data : (res || [])
      this.setData({ productList })
      this.refreshProducts()
      wx.hideLoading();
    } catch (e) {
      console.error('加载商品失败', e)
      wx.hideLoading();
      wx.showToast({ title: '加载商品失败', icon: 'none' })
      this.setData({ productList: [], displayProducts: [] })
    }
  },

  // 根据搜索关键词计算当前展示客户（写进 this.data，WXML 才能读取）
  refreshCustomers() {
    const keyword = (this.data.customerSearchKeyword || '').toLowerCase().trim()
    let list = this.data.customerList || []
    if (keyword) {
      list = list.filter(customer =>
        (customer.name || '').toLowerCase().includes(keyword) ||
        (customer.alias || '').toLowerCase().includes(keyword) ||
        (customer.phone || '').includes(keyword) ||
        (customer.contact || '').toLowerCase().includes(keyword)
      )
    }
    // 确保 displayCustomers 总是有值
    this.setData({ displayCustomers: list })
  },

  // 根据搜索关键词计算当前展示商品（无关键词仅前 8 个，附价格文案）
  refreshProducts() {
    const keyword = (this.data.productSearchKeyword || '').toLowerCase().trim()
    let list = this.data.productList || []
    if (keyword) {
      list = list.filter(product =>
        (product.name || '').toLowerCase().includes(keyword) ||
        (product.material_code && String(product.material_code).toLowerCase().includes(keyword)) ||
        (product.pinyin && product.pinyin.toLowerCase().includes(keyword)) ||
        (product.spec && product.spec.toLowerCase().includes(keyword))
      )
    } else {
      list = list.slice(0, 8)
    }
    list = list.map(p => Object.assign({}, p, {
      priceText: this.priceLine(p.pricing_mode || 'case', p)
    }))
    this.setData({ displayProducts: list })
  },

  async loadOrder(id) {
    this._editingOrderId = id
    try {
      const { callCloud } = require('../../utils/request')
      const order = await callCloud('orders', { action: 'detail', orderId: id })
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' })
        return
      }
      const customer = {
        _id: order.customerId,
        name: order.customerName || ''
      }
      // 还原商品明细（对齐 prefillFromLastOrder 的行结构）
      const items = (order.items || []).map(li => {
        const mode = li.pricing_mode || 'case'
        return {
          _id: li._id || li.material_code || '',
          material_code: li.material_code || '',
          name: li.name,
          spec: li.spec || '',
          unit: li.unit || '包',
          pricing_mode: mode,
          is_adjustable: li.is_adjustable || false,
          price_piece: li.price_piece != null ? li.price_piece : 0,
          price_unit: li.price_unit != null ? li.price_unit : (li.price_zero != null ? li.price_zero : 0),
          piece_qty: li.piece_qty || 0,
          package_qty: li.package_qty != null ? li.package_qty : (li.zero_qty || 0),
          remark: li.remark || ''
        }
      })
      this.setData({ customer, items, editMode: true })
      wx.setNavigationBarTitle && wx.setNavigationBarTitle({ title: '编辑订单' })
      this.calcTotal()
    } catch (e) {
      console.error('加载订单失败', e)
      wx.showToast({ title: '加载订单失败', icon: 'none' })
    }
  },

  // ============ 客户选择 ============
  selectCustomer() {
    this.setData({ showCustomerModal: true })
  },

  closeCustomerModal() {
    this.setData({ showCustomerModal: false })
  },

  
  async selectCustomerItem(e) {
    const customer = e.currentTarget.dataset.item
    if (!customer) {
      console.error('❌ 客户数据为空')
      return
    }
    
    this.setData({
      customer: customer,
      showCustomerModal: false,
      customerSearchKeyword: ''
    })

    // 1.0：选择客户后自动带出上次订单的商品与数量（对齐原型 prefillFromLastOrder）
    this._lastOrderItems = []
    try {
      const { callCloud } = require('../../utils/request')
      const lastItems = await callCloud('orders', { action: 'lastOrder', customerId: customer._id })
      this._lastOrderItems = lastItems || []
      this.prefillFromLastOrder()
      if (this._lastOrderItems && this._lastOrderItems.length) {
        wx.showToast({ title: '已带入上次订单商品，请核对数量', icon: 'none' })
      }
    } catch (err) {
      console.error('加载上次订单失败', err)
      this._lastOrderItems = []
    }
  },

onCustomerSearch(e) {
    const keyword = e.detail.value || ''
    
    // 清除之前的定时器
    if (this.data.customerDebounceTimer) {
      clearTimeout(this.data.customerDebounceTimer)
    }
    
    // 设置新的防抖定时器（200ms）
    const timer = setTimeout(() => {
      this.setData({ customerSearchKeyword: keyword })
      this.refreshCustomers()
    }, 200)
    
    this.setData({ customerDebounceTimer: timer })
  },

  // 1.0：把该客户上次订单的商品+数量直接带出到当前订单（编辑模式不覆盖已有明细）
  prefillFromLastOrder() {
    if (this._editingOrderId) return
    if (!this._lastOrderItems || !this._lastOrderItems.length) {
      // 无上次订单时不自动清空已有明细（避免误删），仅在用户已手工添加时才保留
      return
    }
    // 若当前已有明细（如已手动添加过商品），则不再覆盖
    if (this.data.items && this.data.items.length) return
    const items = (this._lastOrderItems || []).map(li => {
      const mode = li.pricing_mode || 'case'
      return {
        _id: li._id || li.material_code,
        material_code: li.material_code,
        name: li.name,
        spec: li.spec || '',
        unit: li.unit || '包',
        pricing_mode: mode,
        is_adjustable: li.is_adjustable || false,
        price_piece: li.price_piece != null ? li.price_piece : 0,
        price_unit: li.price_unit != null ? li.price_unit : (li.price_zero != null ? li.price_zero : 0),
        piece_qty: li.piece_qty || 0,
        package_qty: li.package_qty != null ? li.package_qty : (li.zero_qty || 0),
        remark: li.remark || '',
        prefilled: true
      }
    })
    this.setData({ items })
    this.calcTotal()
  },

  // ============ 商品选择 ============
  addProduct() {
    this.setData({ showProductModal: true })
  },

  closeProductModal() {
    this.setData({ showProductModal: false })
  },

  onProductSearch(e) {
    const keyword = e.detail.value || ''
    
    // 清除之前的定时器
    if (this.data.productDebounceTimer) {
      clearTimeout(this.data.productDebounceTimer)
    }
    
    // 设置新的防抖定时器（200ms）
    const timer = setTimeout(() => {
      this.setData({ productSearchKeyword: keyword })
      this.refreshProducts()
    }, 200)
    
    this.setData({ productDebounceTimer: timer })
  },

  // 包价归一化：统一取 price_unit（唯一包价字段）
  unitPrice(product) {
    if (product == null) return null
    return product.price_unit != null ? product.price_unit : null
  },

  // 商品价格展示文案
  priceLine(mode, product) {
    const base = (product.unit || '').split('/')[0] || '包'
    const up = this.unitPrice(product)
    if (mode === 'case' && product.price_piece != null && up != null) {
      return `¥${product.price_piece} · ¥${up}/${base}`
    }
    if (mode === 'piece' && product.price_piece != null) {
      return `¥${product.price_piece}/件`
    }
    if (mode === 'unit' && up != null) {
      return `¥${up}/${base}`
    }
    if (product.is_adjustable) return '下单时自填价格'
    return ''
  },

  selectProductItem(e) {
    const product = e.currentTarget.dataset.item
    this.addProductToItems(product)
    this.setData({ showProductModal: false, productSearchKeyword: '' })
    this.refreshProducts()
  },

  // 将商品加入明细（默认数量 0，带上次价格）
  addProductToItems(product) {
    const items = this.data.items
    const existingIndex = items.findIndex(item => item.material_code === product.material_code)
    if (existingIndex >= 0) {
      wx.showToast({ title: '该商品已添加', icon: 'none' })
      return
    }
    const mode = product.pricing_mode || 'case'
    const item = {
      _id: product._id,
      material_code: product.material_code,
      name: product.name,
      spec: product.spec || '',
      unit: product.unit || '包',
      pricing_mode: mode,
      is_adjustable: product.is_adjustable || false,
      price_piece: product.price_piece != null ? product.price_piece : 0,
      price_unit: this.unitPrice(product) != null ? this.unitPrice(product) : 0,
      piece_qty: 0,
      package_qty: 0,
      remark: ''
    }
    // 带出客户上次价格
    const last = (this._lastOrderItems || []).find(it => it.material_code === product.material_code)
    if (last) {
      if (last.price_piece != null) item.price_piece = last.price_piece
      if (last.price_unit != null) item.price_unit = last.price_unit
    }
    items.push(item)
    this.calcTotal()
    this.setData({ items })
  },

  // ============ 数量双轨 ============
  adjustQty(e) {
    const { index, field } = e.currentTarget.dataset
    const delta = Number(e.currentTarget.dataset.delta) // dataset 返回字符串，显式转数字避免 "1"+"1"="11"
    const items = this.data.items
    items[index][field] = Math.max(0, (items[index][field] || 0) + delta)
    this.calcTotal()
    this.setData({ items })
  },

  onQtyInput(e) {
    const { index, field } = e.currentTarget.dataset
    // T57-RA-4：原 parseInt 静默吞小数（"2.5"→2 无任何提示）；现小数显式提示并取整
    const raw = e.detail.value
    if (raw && /^d+.+d*$/.test(raw.trim())) {
      wx.showToast({ title: '数量须为整数', icon: 'none' })
    }
    const val = parseInt(raw, 10) || 0
    const items = this.data.items
    items[index][field] = Math.max(0, val)
    this.calcTotal()
    this.setData({ items })
  },

  // ============ 下单内改价（仅当前订单） ============
  onPriceInput(e) {
    const { index, field } = e.currentTarget.dataset
    const val = parseFloat(e.detail.value)
    const items = this.data.items
    items[index][field] = isNaN(val) || val < 0 ? 0 : val
    this.calcTotal()
    this.setData({ items })
  },

  onRemarkInput(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.items
    // T57-RA-4：备注上限 100 字（原无上限，超长备注会撑爆打印单排版与列表行高）
    items[index].remark = String(e.detail.value || '').slice(0, 100)
    this.setData({ items })
  },

  removeItem(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.items
    items.splice(index, 1)
    this.calcTotal()
    this.setData({ items })
  },

  calcTotal() {
    // 同步每行小计，供 WXML 展示
    const items = this.data.items.map(it => Object.assign({}, it, {
      subtotal: pricing.fmtMoney(pricing.calcItemAmount(it))
    }))
    const total = pricing.calcOrderAmount(items)
    this.setData({ items, totalAmount: pricing.fmtMoney(total) })
  },

  // ============ 智能录入 ============
  openSmartInput() {
    // 页面入口：默认文字 tab（对齐原型 openSmartInputModal）
    this.setData({ showSmartModal: true, smartTab: 'text' })
  },

  // 切换文字/语音录入 tab（对齐原型 switchSmartTab）
  switchSmartTab(e) {
    this.setData({ smartTab: e.currentTarget.dataset.tab })
  },

  closeSmartModal() {
    if (this.data.voiceState === 'recording' && this._voiceRecorder) {
      try { this._voiceRecorder.stop() } catch (e) {}
    }
    this.setData({ showSmartModal: false, smartInputText: '', smartPreviewItems: [], voiceState: 'idle', smartTab: 'text' })
  },

  // ============ 语音录入（腾讯云 ASR） ============
  async startVoiceInput() {
    // 1) 录音 scope 权限
    try {
      const setting = await wx.getSetting()
      if (setting.authSetting['scope.record'] === false) {
        wx.showModal({
          title: '需要录音权限',
          content: '请在小程序设置中允许录音后重试',
          confirmText: '去设置',
          success: (m) => { if (m.confirm) wx.openSetting() }
        })
        return
      }
      if (!setting.authSetting['scope.record']) {
        const res = await wx.authorize({ scope: 'record' })
        if (!res.auth) {
          wx.showModal({
            title: '需要录音权限',
            content: '请在小程序设置中允许录音后重试',
            confirmText: '去设置',
            success: (m) => { if (m.confirm) wx.openSetting() }
          })
          return
        }
      }
    } catch (e) { /* getSetting 异常继续，start 时再兜底提示 */ }

    // 2) 隐私授权（T45：新基础库录音属隐私接口，未同意隐私协议会 fail:start）
    try {
      if (wx.requirePrivacyAuthorize) {
        await new Promise((resolve, reject) => {
          wx.requirePrivacyAuthorize({ success: resolve, fail: reject })
        })
      }
    } catch (e) {
      wx.showModal({
        title: '需要同意隐私协议',
        content: '语音输入需要使用麦克风。请同意隐私协议；若未出现弹窗，请联系管理员在公众平台配置「用户隐私保护指引-麦克风」',
        showCancel: false
      })
      this.setData({ voiceState: 'idle' })
      return
    }

    const { callCloud } = require('../../utils/request')
    // 检查 ASR 是否已配置（不泄露密钥，任意下单员可查）
    let asrReady = false
    try {
      const st = await callCloud('smart', { action: 'checkAsrReady' })
      asrReady = !!(st && st.ready)
    } catch (e) { asrReady = false }
    if (!asrReady) {
      wx.showModal({ title: '语音识别未配置', content: '请管理员在「我的-系统设置」配置腾讯云语音（ASR）后使用', showCancel: false })
      return
    }

    const recorder = wx.getRecorderManager()
    this._voiceRecorder = recorder
    recorder.onStop((res) => { this._onVoiceRecorded(res) })
    recorder.onError((err) => {
      this.setData({ voiceState: 'idle' })
      const msg = (err && err.errMsg) || '录音失败'
      // 隐私/权限类失败给明确指引，而非原始错误码
      if (/privacy|denied|authorize/i.test(msg)) {
        wx.showModal({
          title: '无法开始录音',
          content: '麦克风权限未开启：请在弹窗中同意隐私协议并允许使用麦克风；若仍失败，请检查公众平台「用户隐私保护指引」是否已配置麦克风',
          showCancel: false
        })
      } else {
        wx.showToast({ title: msg, icon: 'none' })
      }
    })
    try {
      recorder.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3'
      })
      this.setData({ voiceState: 'recording' })
    } catch (e) {
      this.setData({ voiceState: 'idle' })
      wx.showToast({ title: '无法开始录音', icon: 'none' })
    }
  },

  stopVoiceInput() {
    if (this._voiceRecorder && this.data.voiceState === 'recording') {
      try { this._voiceRecorder.stop() } catch (e) {}
    }
  },

  async _onVoiceRecorded(res) {
    this.setData({ voiceState: 'transcribing' })
    const tempPath = res && res.tempFilePath
    if (!tempPath || (res && res.duration < 500)) {
      this.setData({ voiceState: 'idle' })
      wx.showToast({ title: '录音太短，请重试', icon: 'none' })
      return
    }
    try {
      // 1) 上传到 CloudBase 存储
      const fileID = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: 'voice/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.mp3',
          filePath: tempPath,
          success: r => resolve(r.fileID),
          fail: e => reject(e)
        })
      })
      // 2) 云函数转写（smart.transcribe）
      const { callCloud } = require('../../utils/request')
      const data = await callCloud('smart', { action: 'transcribe', fileID })
      const text = (data && data.text) || ''
      if (text.trim()) {
        this.setData({ smartInputText: text, voiceState: 'idle' })
        this.onSmartInputChange({ detail: { value: text } })
        wx.showToast({ title: '语音识别完成', icon: 'success' })
      } else {
        this.setData({ voiceState: 'idle' })
        wx.showModal({
          title: '未识别到内容',
          content: data && data.engine === 'fallback' ? ('识别失败：' + (data.error || '请重试')) : '没听清，请说清楚一点再试',
          showCancel: false
        })
      }
    } catch (e) {
      this.setData({ voiceState: 'idle' })
      wx.showToast({ title: '语音识别失败，请重试', icon: 'none' })
    }
  },

  onSmartInputChange(e) {
    const text = e.detail.value
    this.setData({ smartInputText: text })
    if (text.trim()) {
      const lines = text.split('\n').filter(line => line.trim())
      const previewItems = lines.map(line => {
        const match = line.trim().match(/^(.+?)\s*(\d+)\s*(件|箱|包|个)?$/)
        return {
          name: match ? match[1].trim() : line.trim(),
          qty: match ? parseInt(match[2]) : 1
        }
      })
      this.setData({ smartPreviewItems: previewItems })
    } else {
      this.setData({ smartPreviewItems: [] })
    }
  },

  // 在线智能解析：调 smart 云函数 parseWithAI（规则优先 + AI 兜底）
  async parseOnline(text) {
    const { callCloud } = require('../../utils/request')
    try {
      const res = await callCloud('smart', { action: 'parseWithAI', text })
      const srcItems = (res && res.items) || []
      if (srcItems.length === 0) return null
      const addedNames = []
      srcItems.forEach(it => {
        // 有具体商品（已匹配到库内产品）
        if (it.material_code) {
          const existing = this.data.items.find(x => x.material_code === it.material_code)
          const qty = parseFloat(it.qty) || 1
          const unit = it.unit || '包'
          const pieceUnits = ['件','箱','捆','提','桶']
          const usePiece = pieceUnits.includes(unit)
          const mode = it.pricing_mode || 'case'
          if (existing) {
            if (mode === 'unit' || !usePiece) existing.package_qty += qty
            else existing.piece_qty += qty
          } else {
            const prod = this.data.productList.find(ppl => String(ppl.material_code) === String(it.material_code))
            this.data.items.push({
              _id: prod ? prod._id : it._id,
              material_code: it.material_code,
              name: it.name || (prod && prod.name) || '',
              spec: it.spec || (prod && prod.spec) || '',
              unit: (prod && prod.unit) || unit || '包',
              pricing_mode: mode,
              is_adjustable: prod ? (prod.is_adjustable || false) : true,
              price_piece: it.price != null ? it.price : (prod ? (prod.price_piece || 0) : 0),
              price_unit: it.price_unit != null ? it.price_unit : 0,
              piece_qty: (mode === 'unit' || !usePiece) ? 0 : qty,
              package_qty: (mode === 'unit' || !usePiece) ? qty : 0,
              remark: ''
            })
          }
          addedNames.push(it.name)
        } else if (it.name) {
          // 未匹配到库内产品：作为可调自由项加入
          const qty = parseFloat(it.qty) || 1
          this.data.items.push({
            _id: Date.now().toString() + Math.random().toString(),
            material_code: '',
            name: it.name,
            spec: it.spec || '',
            unit: it.unit || '包',
            pricing_mode: 'unit',
            is_adjustable: true,
            price_piece: 0,
            price_unit: 0,
            piece_qty: 0,
            package_qty: qty,
            remark: ''
          })
          addedNames.push(it.name)
        }
      })
      return addedNames
    } catch (e) {
      console.error('在线解析失败，回落本地', e)
      return null
    }
  },

  async processSmartInput() {
    if (!this.data.smartInputText.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    this.setData({ smartInputLoading: true })
    try {
      // 优先在线解析：云函数先走规则引擎、规则不中调 AI（中转站/千问并存降级）
      const online = await this.parseOnline(this.data.smartInputText)
      if (online && online.length > 0) {
        this.calcTotal()
        this.setData({ items: this.data.items, smartInputLoading: false, smartInputText: '', smartPreviewItems: [] })
        wx.showToast({ title: `已添加 ${online.length} 项`, icon: 'success' })
        return
      }
      const lines = this.data.smartInputText.split('\n').filter(line => line.trim())
      const added = []
      lines.forEach(line => {
        const match = line.trim().match(/^(.+?)\s*(\d+)\s*(件|箱|包|个)?$/)
        const itemName = match ? match[1].trim() : line.trim()
        const qty = match ? parseInt(match[2]) : 1
        const product = this.data.productList.find(p =>
          (p.name && (p.name.includes(itemName) || itemName.includes(p.name))) ||
          (p.material_code && String(p.material_code) === itemName)
        )
        if (product) {
          const existing = this.data.items.find(it => it.material_code === product.material_code)
          if (existing) {
            const mode = product.pricing_mode || 'case'
            if (mode === 'unit') existing.package_qty += qty
            else existing.piece_qty += qty
            added.push(product.name)
          } else {
            // 临时加入 items 再走带价逻辑
            this.data.items.push({
              _id: product._id,
              material_code: product.material_code,
              name: product.name,
              spec: product.spec || '',
              unit: product.unit || '包',
              pricing_mode: product.pricing_mode || 'case',
              is_adjustable: product.is_adjustable || false,
              price_piece: product.price_piece != null ? product.price_piece : 0,
              price_unit: this.unitPrice(product) != null ? this.unitPrice(product) : 0,
              piece_qty: 0,
              package_qty: 0,
              remark: ''
            })
            const idx = this.data.items.length - 1
            if (product.pricing_mode === 'unit') this.data.items[idx].package_qty = qty
            else this.data.items[idx].piece_qty = qty
            added.push(product.name)
          }
        } else {
          this.data.items.push({
            _id: Date.now().toString() + Math.random().toString(),
            material_code: '',
            name: itemName,
            spec: '',
            unit: '包',
            pricing_mode: 'unit',
            is_adjustable: true,
            price_piece: 0,
            price_unit: 0,
            piece_qty: 0,
            package_qty: qty,
            remark: ''
          })
          added.push(itemName)
        }
      })
      this.calcTotal()
      this.setData({ items: this.data.items, smartInputLoading: false, smartInputText: '', smartPreviewItems: [] })
      wx.showToast({ title: `已添加 ${added.length} 项`, icon: 'success' })
    } catch (e) {
      console.error('智能识别失败', e)
      wx.showToast({ title: '识别失败，请手动添加', icon: 'none' })
      this.setData({ smartInputLoading: false })
    }
  },

  // ============ 保存 ============
  async saveOrder() {
    if (!this.data.customer) {
      wx.showToast({ title: '请选择客户', icon: 'none' })
      return
    }
    if (!this.data.items.length) {
      wx.showToast({ title: '请添加商品', icon: 'none' })
      return
    }
    // 0 元订单拦截
    const total = pricing.calcOrderAmount(this.data.items)
    if (total <= 0) {
      wx.showToast({ title: '订单金额为 0，请先填写有效数量', icon: 'none' })
      return
    }
    // 过滤 0件0个 的商品行
    const items = this.data.items.filter(it => (it.piece_qty || 0) > 0 || (it.package_qty || 0) > 0)
    if (!items.length) {
      wx.showToast({ title: '无可提交商品', icon: 'none' })
      return
    }
    try {
      const { callCloud } = require('../../utils/request')
      const payload = {
        customerId: this.data.customer._id,
        customerName: this.data.customer.name,
        customerRegion: this.data.customer.region || '',
        items,
        totalAmount: pricing.fmtMoney(total)
      }
      if (this._editingOrderId) {
        payload.orderId = this._editingOrderId
        await callCloud('orders', Object.assign({ action: 'update' }, payload))
        wx.showToast({ title: '订单已更新', icon: 'success' })
      } else {
        await callCloud('orders', Object.assign({ action: 'create' }, payload))
        wx.showToast({ title: '订单已创建', icon: 'success' })
      }
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      console.error('创建订单失败', e)
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
