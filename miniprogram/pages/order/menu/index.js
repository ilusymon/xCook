const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    categories: [],
    dishMap: {},        // { categoryId: [dishes] }
    currentCategory: 0,
    scrollToView: '',
    starCoins: 0,
    cartSummary: { totalCount: 0, totalPrice: 0, totalCalories: 0 }
  },

  onShow() {
    this.setData({ starCoins: app.globalData.starCoins })
    this.refreshCart()
    this.loadMenu()
  },

  loadMenu() {
    wx.showLoading({ title: '加载中...' })
    cloud.getMenu().then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({
          categories: res.categories || [],
          dishMap: res.dishes || {}
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onCategoryTap(e) {
    const { index, id } = e.currentTarget.dataset
    this.setData({
      currentCategory: index,
      scrollToView: 'cat_' + id
    })
  },

  onDishTap(e) {
    const { dish } = e.detail
    wx.navigateTo({
      url: `/pages/order/dish-detail/index?id=${dish._id}`
    })
  },

  onDishAdd(e) {
    const { dish } = e.detail
    // 如果菜品没有选项组，直接加入购物车
    if (!dish.optionGroups || dish.optionGroups.length === 0) {
      const cartItem = {
        dishId: dish._id,
        dishName: dish.name,
        coverImage: dish.coverImage,
        unitPrice: dish.price,
        calories: dish.calories,
        quantity: 1,
        selectedOptions: {},
        extraPrice: 0,
        itemTotal: dish.price
      }
      app.addToCart(cartItem)
      this.refreshCart()
      wx.showToast({ title: '已加入购物车', icon: 'success' })
    } else {
      // 有选项的跳详情页
      wx.navigateTo({
        url: `/pages/order/dish-detail/index?id=${dish._id}`
      })
    }
  },

  refreshCart() {
    const summary = app.getCartSummary()
    this.setData({ cartSummary: summary })
  },

  onDishScroll() {
    // 可选：根据滚动位置联动左侧分类高亮
  }
})
