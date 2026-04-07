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
    starCoins: 0,
    cart: []
  },

  // 加载用户信息
  loadUserInfo() {
    return cloud.getUserInfo().then(user => {
      if (user) {
        this.globalData.userInfo = user
        this.globalData.openid = user.openid
        this.globalData.role = user.role
        this.globalData.starCoins = user.starCoins
      }
    }).catch(err => {
      console.error('初始化用户信息失败', err)
    })
  },

  // 加载购物车
  loadCart() {
    const cart = wx.getStorageSync('cart') || []
    this.globalData.cart = cart
  },

  // 保存购物车
  saveCart(cart) {
    this.globalData.cart = cart
    wx.setStorageSync('cart', cart)
  },

  // 添加到购物车
  addToCart(item) {
    const cart = this.globalData.cart
    // 检查是否存在相同菜品 + 相同选项的项
    const existIndex = cart.findIndex(c =>
      c.dishId === item.dishId &&
      JSON.stringify(c.selectedOptions) === JSON.stringify(item.selectedOptions)
    )
    if (existIndex > -1) {
      cart[existIndex].quantity += item.quantity
      cart[existIndex].itemTotal = (cart[existIndex].unitPrice + cart[existIndex].extraPrice) * cart[existIndex].quantity
    } else {
      item.cartItemId = this.generateId()
      cart.push(item)
    }
    this.saveCart(cart)
    return cart
  },

  // 更新购物车项数量
  updateCartItemQuantity(cartItemId, quantity) {
    const cart = this.globalData.cart
    const index = cart.findIndex(c => c.cartItemId === cartItemId)
    if (index > -1) {
      if (quantity <= 0) {
        cart.splice(index, 1)
      } else {
        cart[index].quantity = quantity
        cart[index].itemTotal = (cart[index].unitPrice + cart[index].extraPrice) * quantity
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
    let totalPrice = 0
    let totalCalories = 0
    let totalCount = 0
    cart.forEach(item => {
      totalPrice += item.itemTotal
      totalCalories += item.calories * item.quantity
      totalCount += item.quantity
    })
    return { totalPrice, totalCalories, totalCount }
  },

  // 生成唯一 ID
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }
})
