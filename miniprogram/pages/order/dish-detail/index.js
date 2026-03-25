const app = getApp()
const cloud = require('../../../utils/cloud')
const { DIFFICULTY } = require('../../../utils/constants')

Page({
  data: {
    dish: {},
    quantity: 1,
    extraPrice: 0,
    totalPrice: 0,
    totalCalories: 0,
    difficultyText: ''
  },

  onLoad(options) {
    if (options.id) {
      this.loadDish(options.id)
    }
  },

  loadDish(dishId) {
    wx.showLoading({ title: '加载中...' })
    cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({
          dish: res,
          difficultyText: DIFFICULTY[res.difficulty] || ''
        })
        this.calcTotal()
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onOptionChange(e) {
    this.setData({ extraPrice: e.detail.extraPrice || 0 })
    this.calcTotal()
  },

  increaseQty() {
    this.setData({ quantity: this.data.quantity + 1 })
    this.calcTotal()
  },

  decreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 })
      this.calcTotal()
    }
  },

  calcTotal() {
    const { dish, quantity, extraPrice } = this.data
    const totalPrice = (dish.price + extraPrice) * quantity
    const totalCalories = dish.calories * quantity
    this.setData({ totalPrice, totalCalories })
  },

  addToCart() {
    const { dish, quantity, extraPrice } = this.data
    const picker = this.selectComponent('#optionPicker')

    // 验证必选项
    if (picker) {
      const validation = picker.validate()
      if (!validation.valid) {
        wx.showToast({ title: validation.message, icon: 'none' })
        return
      }
    }

    const selectedOptions = picker ? picker.getSelections() : {}

    const cartItem = {
      dishId: dish._id,
      dishName: dish.name,
      coverImage: dish.coverImage,
      unitPrice: dish.price,
      calories: dish.calories,
      quantity,
      selectedOptions,
      extraPrice,
      itemTotal: (dish.price + extraPrice) * quantity
    }

    app.addToCart(cartItem)
    wx.showToast({ title: '已加入购物车 💕', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 800)
  }
})
