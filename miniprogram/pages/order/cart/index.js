const app = getApp()
const { formatCartItem } = require('../../../utils/format')

Page({
  data: {
    cart: [],
    totalCount: 0,
    totalCalories: 0
  },

  onShow() {
    this.refreshCart()
  },

  refreshCart() {
    const cart = app.globalData.cart.map(formatCartItem)

    const summary = app.getCartSummary()
    this.setData({
      cart,
      totalCount: summary.totalCount,
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
    if (!this.data.cart.length) return
    wx.navigateTo({ url: '/package-order/pages/checkout/index' })
  },

  goMenu() {
    wx.switchTab({ url: '/pages/order/menu/index' })
  }
})
