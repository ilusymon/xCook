const app = getApp()

Page({
  data: {
    cart: [],
    starCoins: 0,
    totalCount: 0,
    totalPrice: 0,
    totalCalories: 0
  },

  onShow() {
    this.refreshCart()
    this.setData({ starCoins: app.globalData.starCoins })
  },

  refreshCart() {
    const cart = app.globalData.cart.map(item => {
      // 将 selectedOptions 转为标签数组用于显示
      const optionTags = []
      if (item.selectedOptions) {
        Object.keys(item.selectedOptions).forEach(group => {
          const vals = item.selectedOptions[group]
          if (Array.isArray(vals)) {
            vals.forEach(v => optionTags.push(v))
          }
        })
      }
      return { ...item, optionTags }
    })

    const summary = app.getCartSummary()
    this.setData({
      cart,
      totalCount: summary.totalCount,
      totalPrice: summary.totalPrice,
      totalCalories: summary.totalCalories
    })
  },

  increaseQty(e) {
    const id = e.currentTarget.dataset.id
    const item = app.globalData.cart.find(c => c.cartItemId === id)
    if (item) {
      app.updateCartItemQuantity(id, item.quantity + 1)
      this.refreshCart()
    }
  },

  decreaseQty(e) {
    const id = e.currentTarget.dataset.id
    const item = app.globalData.cart.find(c => c.cartItemId === id)
    if (item) {
      if (item.quantity <= 1) {
        this.removeItem(e)
      } else {
        app.updateCartItemQuantity(id, item.quantity - 1)
        this.refreshCart()
      }
    }
  },

  removeItem(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除这道菜吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          app.removeCartItem(id)
          this.refreshCart()
        }
      }
    })
  },

  clearCart() {
    wx.showModal({
      title: '提示',
      content: '确定清空购物车吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          app.clearCart()
          this.refreshCart()
        }
      }
    })
  },

  goCheckout() {
    wx.navigateTo({ url: '/pages/order/checkout/index' })
  }
})
