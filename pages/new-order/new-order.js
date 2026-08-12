Page({
  data: {
    customer: null,
    items: [],
    totalAmount: 0,
    showCustomerModal: false,
    showProductModal: false,
    showSmartModal: false,
    customerList: [],
    productList: [],
    customerSearchKeyword: '',
    productSearchKeyword: '',
    smartInputText: '',
    smartInputLoading: false,
    smartPreviewItems: []
  },

  // 计算属性：过滤客户列表
  get filteredCustomers() {
    const keyword = this.data.customerSearchKeyword.toLowerCase().trim()
    if (!keyword) return this.data.customerList
    return this.data.customerList.filter(customer => 
      customer.name.toLowerCase().includes(keyword) ||
      customer.alias.toLowerCase().includes(keyword) ||
      customer.phone.includes(keyword) ||
      customer.contact.toLowerCase().includes(keyword)
    )
  },

  // 计算属性：过滤商品列表
  get filteredProducts() {
    const keyword = this.data.productSearchKeyword.toLowerCase().trim()
    if (!keyword) return this.data.productList
    return this.data.productList.filter(product => 
      product.name.toLowerCase().includes(keyword) ||
      (product.material_code && product.material_code.toLowerCase().includes(keyword)) ||
      (product.pinyin && product.pinyin.toLowerCase().includes(keyword)) ||
      (product.spec && product.spec.toLowerCase().includes(keyword))
    )
  },

  onLoad(options) {
    if (options.id) {
      this.loadOrder(options.id)
    }
    this.loadCustomers()
    this.loadProducts()
  },

  async loadCustomers() {
    try {
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('customers', { action: 'list' })
      this.setData({ customerList: res.data || [] })
    } catch (e) {
      console.error('加载客户失败', e)
    }
  },

  async loadProducts() {
    try {
      const { callCloud } = require('../../utils/request')
      const res = await callCloud('products', { action: 'list' })
      this.setData({ productList: res.data || [] })
    } catch (e) {
      console.error('加载商品失败', e)
    }
  },

  loadOrder(id) {
    console.log('加载订单', id)
  },

  selectCustomer() {
    this.setData({ showCustomerModal: true })
  },

  closeCustomerModal() {
    this.setData({ showCustomerModal: false })
  },

  onCustomerSearch(e) {
    this.setData({ customerSearchKeyword: e.detail.value })
    // 触发重新渲染
    this.setData({ 
      customerSearchKeyword: e.detail.value,
      // 强制更新 filteredCustomers
      customerList: [...this.data.customerList]
    })
  },

  selectCustomerItem(e) {
    const customer = e.currentTarget.dataset.item
    this.setData({
      customer,
      showCustomerModal: false
    })
  },

  addProduct() {
    this.setData({ showProductModal: true })
  },

  closeProductModal() {
    this.setData({ showProductModal: false })
  },

  onProductSearch(e) {
    this.setData({ productSearchKeyword: e.detail.value })
    // 触发重新渲染
    this.setData({ 
      productSearchKeyword: e.detail.value,
      // 强制更新 filteredProducts
      productList: [...this.data.productList]
    })
  },

  selectProductItem(e) {
    const product = e.currentTarget.dataset.item
    const items = this.data.items
    const existingIndex = items.findIndex(item => item._id === product._id)
    if (existingIndex >= 0) {
      wx.showToast({ title: '该商品已添加', icon: 'none' })
      return
    }
    // 根据计价模式选择价格：按件选 price_piece，按包选 price_unit
    let price = 0
    if (product.pricing_mode === 'case') {
      price = product.price_piece || 0  // 按件计价，使用件价
    } else if (product.pricing_mode === 'piece') {
      price = product.price_unit || 0  // 按个/按包计价，使用包价
    } else if (product.pricing_mode === 'unit') {
      price = product.price_unit || 0  // 按单位计价，使用包价
    }
    
    items.push({
      _id: product._id,
      name: product.name,
      spec: product.spec || '',
      price: price,
      unit: product.unit || '包',  // 保存单位
      qty: 1
    })
    this.calcTotal()
    this.setData({ items, showProductModal: false })
  },

  onQtyChange(e) {
    const index = e.currentTarget.dataset.index
    const qty = parseFloat(e.detail.value) || 0
    const items = this.data.items
    items[index].qty = qty
    this.setData({ items })
    this.calcTotal()
  },

  removeItem(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.items
    items.splice(index, 1)
    this.calcTotal()
    this.setData({ items })
  },

  calcTotal() {
    let total = 0
    this.data.items.forEach(item => {
      total += (item.price || 0) * (item.qty || 0)
    })
    this.setData({ totalAmount: total.toFixed(2) })
  },

  openSmartInput() {
    this.setData({ showSmartModal: true })
  },

  closeSmartModal() {
    this.setData({ showSmartModal: false, smartInputText: '', smartPreviewItems: [] })
  },

  onSmartInputChange(e) {
    const text = e.detail.value
    this.setData({ smartInputText: text })
    
    // 简单的智能识别预览
    if (text.trim()) {
      const lines = text.split('\n').filter(line => line.trim())
      const previewItems = lines.map(line => {
        // 简单解析：假设格式为 "商品名 数量"
        const match = line.match(/^(.+?)(\d+)(件 | 箱 | 包 | 个)$/)
        if (match) {
          return {
            name: match[1].trim(),
            qty: parseInt(match[2])
          }
        }
        return {
          name: line.trim(),
          qty: 1
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
    
    // 使用简单的本地解析，不调用云函数
    try {
      const lines = this.data.smartInputText.split('\n').filter(line => line.trim())
      const items = this.data.items
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        // 简单解析：假设格式为 "商品名 数量"
        const match = line.trim().match(/^(.+?)(\d+)(件 | 箱 | 包 | 个)$/)
        let itemName = line.trim()
        let qty = 1
        
        if (match) {
          itemName = match[1].trim()
          qty = parseInt(match[2])
        }
        
        // 在商品列表中查找匹配
        const product = this.data.productList.find(p => 
          p.name.includes(itemName) || itemName.includes(p.name)
        )
        
        if (product) {
          // 根据计价模式选择价格
          let price = 0
          if (product.pricing_mode === 'case') {
            price = product.price_piece || 0  // 按件计价，使用件价
          } else if (product.pricing_mode === 'piece') {
            price = product.price_unit || 0  // 按个/按包计价，使用包价
          } else if (product.pricing_mode === 'unit') {
            price = product.price_unit || 0  // 按单位计价，使用包价
          }
          
          const existingIndex = items.findIndex(item => item._id === product._id)
          if (existingIndex >= 0) {
            items[existingIndex].qty += qty
          } else {
            items.push({
              _id: product._id,
              name: product.name,
              spec: product.spec || '',
              price: price,
              unit: product.unit || '包',
              qty: qty
            })
          }
        } else {
          // 未找到匹配商品，添加临时项
          items.push({
            _id: Date.now().toString() + Math.random().toString(),
            name: itemName,
            spec: '',
            price: 0,
            qty: qty
          })
        }
      }
      
      this.calcTotal()
      this.setData({ items, smartInputLoading: false, smartInputText: '', smartPreviewItems: [] })
      wx.showToast({ title: `已添加 ${lines.length} 项商品`, icon: 'success' })
    } catch (e) {
      console.error('智能识别失败', e)
      wx.showToast({ title: '识别失败，请手动添加', icon: 'none' })
      this.setData({ smartInputLoading: false })
    }
  },

  async saveOrder() {
    if (!this.data.customer) {
      wx.showToast({ title: '请选择客户', icon: 'none' })
      return
    }
    if (!this.data.items.length) {
      wx.showToast({ title: '请添加商品', icon: 'none' })
      return
    }
    if (this.data.totalAmount <= 0) {
      wx.showToast({ title: '订单金额不能为 0', icon: 'none' })
      return
    }
    try {
      const { callCloud } = require('../../utils/request')
      await callCloud('orders', {
        action: 'create',
        customerId: this.data.customer._id,
        customerName: this.data.customer.name,
        items: this.data.items,
        totalAmount: this.data.totalAmount
      })
      wx.showToast({ title: '订单已创建', icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      console.error('创建订单失败', e)
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  }
})
