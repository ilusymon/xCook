Component({
  properties: {
    totalCount: { type: Number, value: 0 },
    totalPrice: { type: Number, value: 0 },
    totalCalories: { type: Number, value: 0 }
  },

  methods: {
    goToCart() {
      if (this.data.totalCount > 0) {
        wx.switchTab({ url: '/pages/order/cart/index' })
      }
    }
  }
})
