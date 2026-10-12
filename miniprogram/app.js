const cloud = require('./utils/cloud')

App({
  onLaunch() {
    this.loadCart()
    this.loadUserInfo()
  },

  globalData: {
    userInfo: null,
    openid: null,
    role: 'both',
    cart: [],
    wishlistRole: 'orderer',
    searchMenu: false
  },

  // 加载用户信息
  loadUserInfo() {
    return cloud.getUserInfo().then(user => {
      if (user) {
        this.globalData.userInfo = user
        this.globalData.openid = user.openid
        this.globalData.role = user.role
      }
    }).catch(err => {
      console.error('初始化用户信息失败', err)
    })
  },

  // 加载购物车
  loadCart() {
    const cart = wx.getStorageSync('cart') || []
    this.globalData.cart = Array.isArray(cart) ? cart.filter(item =>
      item && item.dishId && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99
    ) : []
  },

  // 保存购物车
  saveCart(cart) {
    this.globalData.cart = cart
    wx.setStorageSync('cart', cart)
  },

  // 添加到购物车
  addToCart(item) {
    const cart = this.globalData.cart
    if (!item.dishId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('菜品或数量无效，请重新选择')
    }
    // 检查是否存在相同菜品 + 相同选项的项
    const existIndex = cart.findIndex(c =>
      String(c.dishId) === String(item.dishId) &&
      this.optionKey(c.selectedOptions) === this.optionKey(item.selectedOptions)
    )
    if (item.quantity + (existIndex > -1 ? cart[existIndex].quantity : 0) > 99) {
      throw new Error('每种口味最多选择99份')
    }
    if (existIndex > -1) {
      cart[existIndex].quantity += item.quantity
    } else {
      item.cartItemId = this.generateId()
      cart.push(item)
    }
    this.saveCart(cart)
    return cart
  },

  // 更新购物车项数量
  updateCartItemQuantity(cartItemId, quantity) {
    if (!Number.isInteger(quantity) || quantity > 99) return this.globalData.cart
    const cart = this.globalData.cart
    const index = cart.findIndex(c => c.cartItemId === cartItemId)
    if (index > -1) {
      if (quantity <= 0) {
        cart.splice(index, 1)
      } else {
        cart[index].quantity = quantity
      }
    }
    this.saveCart(cart)
    return cart
  },

  // 删除购物车项
  removeCartItem(cartItemId) {
    let cart = this.globalData.cart
    cart = cart.filter(c => c.cartItemId !== cartItemId)
    this.saveCart(cart)
    return cart
  },

  // 清空购物车
  clearCart() {
    this.saveCart([])
    return []
  },

  // 获取购物车汇总
  getCartSummary() {
    const cart = this.globalData.cart
    let totalCalories = 0
    let totalCount = 0
    cart.forEach(item => {
      totalCalories += Number(item.calories || 0) * item.quantity
      totalCount += item.quantity
    })
    return { totalCalories, totalCount }
  },

  optionKey(options = {}) {
    options = options || {}
    return JSON.stringify(Object.keys(options).sort().map(key => [key, [...options[key]].sort()]))
  },

  // 生成唯一 ID
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }
})
