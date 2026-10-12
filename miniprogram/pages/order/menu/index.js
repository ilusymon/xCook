const app = getApp()
const cloud = require('../../../utils/cloud')
const { formatCartItem } = require('../../../utils/format')

function decorateDish(dish, cart) {
  const quantity = cart.filter(item => String(item.dishId) === String(dish._id))
    .reduce((total, item) => total + item.quantity, 0)
  return { ...dish, _id: String(dish._id), categoryId: String(dish.categoryId), quantity }
}

function buildDishSections(categories, dishes) {
  return categories.map(category => ({
    categoryId: category._id, categoryName: category.name,
    dishes: dishes.filter(dish => dish.categoryId === category._id)
  })).filter(section => section.dishes.length)
}

function getCartPanelHeight(selectedDishes) {
  return 88 + Math.min(selectedDishes.length, 3) * 128
}

Page({
  data: {
    categories: [],
    dishes: [],
    dishSections: [],
    currentCategory: 0,
    categoryScrollTo: '',
    dishScrollTo: '',
    loading: true,
    error: '',
    searchVisible: false,
    keyword: '',
    selectedDishes: [],
    cartPanelVisible: false,
    cartPanelHeight: 84,
    cartSummary: { totalCount: 0, totalCalories: 0 }
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onShow() {
    if (app.globalData.searchMenu) {
      this.setData({ searchVisible: true })
      app.globalData.searchMenu = false
    }
    this.hideNativeTabBar()
    this.refreshCart()
    this.loadMenuData()
  },

  onUnload() {
    this._menuRequestId = null
    this._sectionQueryId = null
    this.onDishTouchStart()
    this._sectionOffsets = []
  },

  onHide() {
    this._sectionQueryId = null
    this.onDishTouchStart()
  },

  onResize() {
    this.measureDishSections()
  },

  toggleSearch() {
    this.setData({ searchVisible: !this.data.searchVisible }, () => this.measureDishSections())
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.filterDishes(true)
  },

  filterDishes(resetScroll = false) {
    const keyword = this.data.keyword.trim().toLowerCase()
    const dishes = this.data.dishes.filter(dish =>
      `${dish.name} ${dish.description || ''}`.toLowerCase().includes(keyword)
    )
    this._sectionOffsets = []
    if (resetScroll) {
      this.onDishTouchStart()
      this.setData({ dishScrollTo: '' })
    }
    this.setData({ dishSections: buildDishSections(this.data.categories, dishes) }, () => {
      if (resetScroll) this.setData({ dishScrollTo: 'dish-list-top' }, () => this.measureDishSections())
      else this.measureDishSections()
    })
  },

  hideNativeTabBar() {
    if (!wx.hideTabBar) return
    wx.hideTabBar({ animation: false })
  },


  loadMenuData() {
    const requestId = Date.now()
    this._menuRequestId = requestId
    this.setData({ loading: true, error: '' })

    cloud.getMenu()
      .then(menuResponse => {
        if (this._menuRequestId !== requestId) return

        const previousCategory = this.data.categories[this.data.currentCategory]
        const categories = ((menuResponse && menuResponse.categories) || []).map(category => ({ ...category, _id: String(category._id) }))
        const menuDishMap = (menuResponse && menuResponse.dishes) || {}
        const cart = app.globalData.cart || []
        const dishes = []

        categories.forEach(category => {
          const categoryDishes = menuDishMap[category._id] || []
          categoryDishes.forEach(dish => {
            dishes.push(decorateDish(dish, cart))
          })
        })

        const dishSections = buildDishSections(categories, dishes)
        const cartSummary = app.getCartSummary()
        const selectedDishes = cart.map(formatCartItem)

        this.setData({
          categories,
          dishes,
          dishSections,
          currentCategory: Math.max(0, previousCategory ? categories.findIndex(category => category._id === previousCategory._id) : 0),
          loading: false,
          selectedDishes,
          cartPanelVisible: false,
          cartPanelHeight: getCartPanelHeight(selectedDishes),
          cartSummary
        }, () => {
          this.filterDishes()
        })
      })
      .catch(err => {
        if (this._menuRequestId !== requestId) return
        console.error('加载分类和菜单失败', err)
        this.setData({ loading: false, error: err.message || '菜单加载失败，请重试' })
      })
  },

  onCategoryTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const category = this.data.categories[index]
    if (!category) return
    if (!this.data.dishSections.some(section => section.categoryId === category._id)) {
      wx.showToast({ title: this.data.keyword ? '这个分类没有匹配结果' : '这个分类暂时没有菜品', icon: 'none' })
      return
    }
    clearTimeout(this._categoryJumpTimer)
    this._categoryJump = true
    this.setData({ currentCategory: index, categoryScrollTo: `category-${category._id}`, dishScrollTo: '' }, () => {
      this.setData({ dishScrollTo: `dish-section-${category._id}` })
      this._categoryJumpTimer = setTimeout(() => { this._categoryJump = false }, 200)
    })
  },

  measureDishSections() {
    const queryId = this._sectionQueryId = {}
    const sections = this.data.dishSections
    this.createSelectorQuery().select('.dish-list').boundingClientRect()
      .select('.dish-list').scrollOffset().selectAll('.dish-section').boundingClientRect()
      .exec(([list, scroll, rects]) => {
        if (queryId !== this._sectionQueryId || sections !== this.data.dishSections || !list || !scroll || !rects || rects.length !== sections.length) return
        this._dishListHeight = list.height
        this._sectionOffsets = rects.map((rect, index) => ({
          top: rect.top - list.top + scroll.scrollTop, categoryId: sections[index].categoryId
        }))
        this.focusVisibleCategory(scroll.scrollTop, scroll.scrollHeight)
      })
  },

  onDishTouchStart() {
    clearTimeout(this._categoryJumpTimer)
    this._categoryJump = false
  },

  onDishScroll(e) {
    this.focusVisibleCategory(e.detail.scrollTop, e.detail.scrollHeight)
  },

  focusVisibleCategory(scrollTop, scrollHeight) {
    const offsets = this._sectionOffsets || []
    if (this._categoryJump || !offsets.length) return
    let section = offsets[0]
    for (const offset of offsets) {
      if (offset.top > scrollTop + 8) break
      section = offset
    }
    if (scrollTop > 0 && scrollTop + this._dishListHeight >= scrollHeight - 2) section = offsets[offsets.length - 1]
    const index = this.data.categories.findIndex(category => category._id === section.categoryId)
    if (index >= 0 && index !== this.data.currentCategory) {
      this.setData({ currentCategory: index, categoryScrollTo: `category-${section.categoryId}` })
    }
  },

  onQuantityTap(e) {
    const id = String(e.currentTarget.dataset.id)
    const delta = Number(e.currentTarget.dataset.delta)
    const cartId = e.currentTarget.dataset.cartId
    if (cartId) {
      const item = app.globalData.cart.find(item => item.cartItemId === cartId)
      if (item) app.updateCartItemQuantity(cartId, item.quantity + delta)
    } else {
      const dish = this.data.dishes.find(dish => dish._id === id)
      if (!dish) return
      if (delta > 0) {
        if ((dish.optionGroups || []).length) {
          this.openDish(id)
          return
        }
        try {
          app.addToCart({ dishId: dish._id, dishName: dish.name, coverImage: dish.coverImage,
            calories: dish.calories, quantity: 1, selectedOptions: {} })
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' })
          return
        }
      } else {
        const item = [...app.globalData.cart].reverse().find(item => String(item.dishId) === id)
        if (item) app.updateCartItemQuantity(item.cartItemId, item.quantity - 1)
      }
    }
    this.refreshCart()
  },

  toggleCartPanel() {
    if (this.data.cartSummary.totalCount === 0) return
    this.setData({ cartPanelVisible: !this.data.cartPanelVisible })
  },

  closeCartPanel() {
    if (!this.data.cartPanelVisible) return
    this.setData({ cartPanelVisible: false })
  },

  stopTap() {},

  goCheckout() {
    if (this.data.cartSummary.totalCount === 0) {
      wx.showToast({ title: '先选几道喜欢的菜吧', icon: 'none' })
      return
    }

    wx.navigateTo({ url: '/package-order/pages/checkout/index' })
  },

  onDishTap(e) {
    this.openDish(e.currentTarget.dataset.id)
  },

  openDish(id) {
    wx.navigateTo({ url: `/package-order/pages/dish-detail/index?id=${id}` })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/order/cart/index' })
  },

  goChef() {
    wx.navigateTo({ url: '/pages/chef/dashboard/index' })
  },

  refreshCart() {
    const cart = app.globalData.cart
    const dishes = this.data.dishes.map(dish => decorateDish(dish, cart))
    const selectedDishes = cart.map(formatCartItem)
    this.setData({ dishes, cartSummary: app.getCartSummary(), selectedDishes,
      cartPanelVisible: selectedDishes.length > 0 && this.data.cartPanelVisible,
      cartPanelHeight: getCartPanelHeight(selectedDishes) })
    this.filterDishes()
  }
})
