const app = getApp()
const cloud = require('../../../utils/cloud')
const { DIFFICULTY } = require('../../../utils/constants')

Page({
  data: {
    dish: {},
    quantity: 1,
    totalCalories: 0,
    difficultyText: '',
    loading: true,
    error: '',
    adding: false
  },

  onLoad(options) {
    this._dishId = options.id
    if (options.id) {
      this.loadDish(options.id)
    } else this.setData({ loading: false, error: '菜品不存在，请返回菜单' })
  },

  loadDish(dishId) {
    dishId = typeof dishId === 'string' ? dishId : this._dishId
    this.setData({ loading: true, error: '' })
    wx.showLoading({ title: '加载中...' })
    cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({
          dish: res,
          loading: false,
          difficultyText: DIFFICULTY[res.difficulty] || ''
        })
        this.calcTotal()
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false, error: err.message || '菜品加载失败' })
    })
  },

  increaseQty() {
    if (this.data.quantity >= 99) return
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
    const { dish, quantity } = this.data
    const totalCalories = dish.calories * quantity
    this.setData({ totalCalories })
  },

  addToCart() {
    const { dish, quantity } = this.data
    if (this.data.adding || this.data.loading || this.data.error) return
    if (dish.isDeleted || !dish.isAvailable) {
      wx.showToast({ title: '这道菜已下架，请选择其他菜品', icon: 'none' })
      return
    }
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
      calories: dish.calories,
      quantity,
      selectedOptions
    }

    try {
      app.addToCart(cartItem)
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
      return
    }
    this.setData({ adding: true })
    wx.showToast({ title: '已放进小餐单', icon: 'success' })
    setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/order/menu/index' }) }), 800)
  }
})
