const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    cart: [],
    note: '',
    totalCount: 0,
    totalCalories: 0
  },

  onLoad() {
    const cart = app.globalData.cart
    const summary = app.getCartSummary()
    this.setData({
      cart,
      totalCount: summary.totalCount,
      totalCalories: summary.totalCalories
    })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  placeOrder() {
    const { cart } = this.data
    if (cart.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认加入愿望单',
      content: '提交后，大厨就会收到这份完整菜单。',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          this.submitWishlist()
        }
      }
    })
  },

  submitWishlist() {
    wx.showLoading({ title: '提交愿望中...' })
    const items = this.data.cart.map(item => ({
      dishId: item.dishId,
      dishName: item.dishName,
      coverImage: item.coverImage,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
      calories: item.calories
    }))

    cloud.createWishlist(items, this.data.note).then(res => {
      wx.hideLoading()
      if (res && res.success) {
        // 清空购物车
        app.clearCart()
        wx.showToast({ title: '愿望已提交 💕', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({
            url: `/package-order/pages/wishlist-detail/index?id=${res.wishlistId}`
          })
        }, 1000)
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    })
  }
})
