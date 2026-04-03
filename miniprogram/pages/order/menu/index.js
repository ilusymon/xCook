const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    categories: [],
    dishMap: {},        // { categoryId: [dishes] }
    currentCategory: 0,
    scrollToView: '',
    starCoins: 0,
    sidebarScrollTo: '',
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
        }, () => {
          setTimeout(() => this.cacheSectionOffsets(), 300)
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onCategoryTap(e) {
    const { index, id } = e.currentTarget.dataset
    const targetView = 'cat_' + id
    const sideView = 'side_' + id
    this._tapping = true

    // 仅当 scrollToView 与目标相同时才需要两步（强制重新滚动）
    if (this.data.scrollToView === targetView) {
      this.setData({
        currentCategory: index,
        sidebarScrollTo: sideView,
        scrollToView: ''
      }, () => {
        this.setData({ scrollToView: targetView })
      })
    } else {
      this.setData({
        currentCategory: index,
        sidebarScrollTo: sideView,
        scrollToView: targetView
      })
    }
    setTimeout(() => { this._tapping = false }, 600)
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

  /* ---- 锚点偏移量驱动的滚动联动 ---- */

  cacheSectionOffsets() {
    this.createSelectorQuery()
      .selectAll('.category-section')
      .boundingClientRect()
      .select('.dish-list')
      .boundingClientRect()
      .select('.dish-list')
      .scrollOffset()
      .exec(res => {
        const sections = res[0]
        const container = res[1]
        const scroll = res[2]
        if (!sections || !sections.length || !container || !scroll) return
        // 绝对偏移量 = 视口相对位置差 + 当前滚动距离
        const st = scroll.scrollTop
        this._sectionOffsets = sections.map(s => s.top - container.top + st)
      })
  },

  onDishScroll(e) {
    if (this._tapping || !this._sectionOffsets) return
    if (this._scrollTimer) return
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null
      const scrollTop = e.detail.scrollTop
      let current = 0
      for (let i = 0; i < this._sectionOffsets.length; i++) {
        if (this._sectionOffsets[i] <= scrollTop + 10) {
          current = i
        }
      }
      if (current !== this.data.currentCategory) {
        const cat = this.data.categories[current]
        this.setData({
          currentCategory: current,
          sidebarScrollTo: cat ? 'side_' + cat._id : ''
        })
      }
    }, 50)
  }
})
