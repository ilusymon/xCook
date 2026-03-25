const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    cart: [],
    note: '',
    totalCount: 0,
    totalPrice: 0,
    totalCalories: 0,
    starCoins: 0
  },

  onLoad() {
    const cart = app.globalData.cart
    const summary = app.getCartSummary()
    this.setData({
      cart,
      totalCount: summary.totalCount,
      totalPrice: summary.totalPrice,
      totalCalories: summary.totalCalories,
      starCoins: app.globalData.starCoins
    })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  placeOrder() {
    const { totalPrice, starCoins, cart, note } = this.data
    if (starCoins < totalPrice) {
      wx.showToast({ title: '星星币不足', icon: 'none' })
      return
    }
    if (cart.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认下单',
      content: `将支付 ${totalPrice} 星星币`,
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          this.submitOrder()
        }
      }
    })
  },

  submitOrder() {
    wx.showLoading({ title: '下单中...' })
    const items = this.data.cart.map(item => ({
      dishId: item.dishId,
      dishName: item.dishName,
      coverImage: item.coverImage,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
      extraPrice: item.extraPrice,
      itemTotal: item.itemTotal,
      calories: item.calories
    }))

    cloud.placeOrder(items, this.data.note).then(res => {
      wx.hideLoading()
      if (res && res.success) {
        // 更新本地余额
        app.globalData.starCoins = res.remainingCoins || (this.data.starCoins - this.data.totalPrice)
        // 清空购物车
        app.clearCart()
        wx.showToast({ title: '下单成功 💕', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/order/order-detail/index?id=${res.orderId}`
          })
        }, 1000)
      } else {
        wx.showToast({ title: res.message || '下单失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '下单失败', icon: 'none' })
    })
  }
})
