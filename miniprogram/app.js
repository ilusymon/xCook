// 从私有配置读取敏感信息（secret.config.js 被 .gitignore 排除）
let secretConfig = {}
try {
  secretConfig = require('./config/secret.config')
} catch (e) {
  console.warn('未找到 secret.config.js，请参照 secret.config.example.js 创建配置文件')
}

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    const cloudEnv = secretConfig.CLOUD_ENV || ''
    if (!cloudEnv) {
      console.error('请在 miniprogram/config/secret.config.js 中配置 CLOUD_ENV')
    }
    wx.cloud.init({
      env: cloudEnv,
      traceUser: true
    })
    this.loadUserInfo()
    this.loadCart()
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
    wx.cloud.callFunction({
      name: 'getUserInfo'
    }).then(res => {
      const user = res.result
      if (user) {
        this.globalData.userInfo = user
        this.globalData.openid = user.openid
        this.globalData.role = user.role
        this.globalData.starCoins = user.starCoins
      }
    }).catch(err => {
      console.error('获取用户信息失败', err)
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
