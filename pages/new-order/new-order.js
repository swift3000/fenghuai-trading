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
    productSearchKeyword: '',
    smartInputText: '',
    smartInputLoading: false,
    smartPreviewItems: [],
    editMode: false
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
      this.setData({ showSmartModal: true })
    }
  },

  async loadCustomers() {
    try {
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('customers', { action: 'list' })
      this.setData({ customerList: res || [] })
      this.refreshCustomers()
    } catch (e) {
      console.error('加载客户失败', e)
    }
  },

  async loadProducts() {
    try {
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('products', { action: 'list' })
      this.setData({ productList: res || [] })
      this.refreshProducts()
    } catch (e) {
      console.error('加载商品失败', e)
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
    console.log('加载订单', id)
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

  onCustomerSearch(e) {
    this.setData({ customerSearchKeyword: e.detail.value })
    this.refreshCustomers()
  },

  async selectCustomerItem(e) {
    const customer = e.currentTarget.dataset.item
    this.setData({ customer, showCustomerModal: false })
    // 1.0：选择客户后自动带出上次订单的商品与数量（对齐原型 prefillFromLastOrder）
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
    this.setData({ productSearchKeyword: e.detail.value })
    this.refreshProducts()
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
    const { index, field, delta } = e.currentTarget.dataset
    const items = this.data.items
    items[index][field] = Math.max(0, (items[index][field] || 0) + delta)
    this.calcTotal()
    this.setData({ items })
  },

  onQtyInput(e) {
    const { index, field } = e.currentTarget.dataset
    const val = parseInt(e.detail.value) || 0
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
    items[index].remark = e.detail.value
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
    this.setData({ showSmartModal: true })
  },

  closeSmartModal() {
    this.setData({ showSmartModal: false, smartInputText: '', smartPreviewItems: [] })
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

  async processSmartInput() {
    if (!this.data.smartInputText.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    this.setData({ smartInputLoading: true })
    try {
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
  onThemeChange(theme) {
    uiStyle.applyUiStyle(this)

    console.log('主题已切换:', theme.name)
    // 页面可以在这里添加自定义逻辑
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
