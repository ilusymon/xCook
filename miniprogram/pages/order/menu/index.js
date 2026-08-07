const app = getApp()
const cloud = require('../../../utils/cloud')

const CATEGORY_ICONS = {
  meat: '/images/menu/06_category_snack.png',
  vegetable: '/images/menu/04_category_recommended.png',
  soup: '/images/menu/04_category_recommended.png',
  staple: '/images/menu/05_category_main.png',
  main: '/images/menu/05_category_main.png',
  snack: '/images/menu/06_category_snack.png',
  dessert: '/images/menu/08_category_dessert.png',
  drink: '/images/menu/07_category_drink.png',
  default: '/images/menu/04_category_recommended.png'
}

const CATEGORY_ICON_FALLBACKS = [
  '/images/menu/04_category_recommended.png',
  '/images/menu/05_category_main.png',
  '/images/menu/06_category_snack.png',
  '/images/menu/07_category_drink.png',
  '/images/menu/08_category_dessert.png'
]

const DISH_ART_FALLBACKS = [
  { image: '/images/menu/09_dish_pasta.png', artWidth: 142, artHeight: 98 },
  { image: '/images/menu/10_dish_rice.png', artWidth: 134, artHeight: 101 },
  { image: '/images/menu/11_dish_burger.png', artWidth: 110, artHeight: 112 },
  { image: '/images/menu/12_dish_fried_chicken.png', artWidth: 126, artHeight: 108 },
  { image: '/images/menu/13_dish_bubble_tea.png', artWidth: 87, artHeight: 123 },
  { image: '/images/menu/14_dish_cake.png', artWidth: 128, artHeight: 100 }
]

const BOTTOM_NAVIGATION = [
  { key: 'menu', label: '菜单', icon: '/images/menu/17_nav_menu.png', iconWidth: 53, iconHeight: 50 },
  { key: 'wishlist', label: '愿望单', icon: '/images/menu/20_nav_wishlist.png', iconWidth: 52, iconHeight: 49 },
  { key: 'record', label: '记录', icon: '/images/menu/18_nav_record.png', iconWidth: 51, iconHeight: 50 },
  { key: 'us', label: '我们', icon: '/images/menu/15_checkout_couple.png', iconWidth: 60, iconHeight: 44 }
]

function decorateCategory(category, index) {
  const iconKey = category.icon || 'default'
  const icon = CATEGORY_ICONS[iconKey] ||
    (String(iconKey).startsWith('/') ? iconKey : CATEGORY_ICON_FALLBACKS[index % CATEGORY_ICON_FALLBACKS.length])
  return Object.assign({}, category, {
    _id: String(category._id),
    icon
  })
}

function decorateDish(dish, index, cart) {
  const fallback = DISH_ART_FALLBACKS[index % DISH_ART_FALLBACKS.length]
  const cartItem = cart.find(item => String(item.dishId) === String(dish._id))
  return Object.assign({}, dish, {
    _id: String(dish._id),
    categoryId: String(dish.categoryId),
    image: dish.coverImage || fallback.image,
    artWidth: dish.coverImage ? 132 : fallback.artWidth,
    artHeight: dish.coverImage ? 108 : fallback.artHeight,
    quantity: cartItem ? cartItem.quantity : 0
  })
}

function buildDishSections(categories, dishes) {
  return categories.map(category => ({
    categoryId: category._id,
    dishes: dishes.filter(dish => dish.categoryId === category._id)
  }))
}

function summarizeDishes(dishes) {
  return dishes.reduce((summary, dish) => {
    summary.totalCount += dish.quantity
    summary.totalPrice += Number(dish.price || 0) * dish.quantity
    summary.totalCalories += Number(dish.calories || 0) * dish.quantity
    return summary
  }, { totalCount: 0, totalPrice: 0, totalCalories: 0 })
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 64,
    navigationContentTop: 20,
    navigationContentHeight: 44,
    ginghamTiles: Array.from({ length: 40 }, (_, index) => index),
    categories: [],
    dishes: [],
    dishSections: [],
    bottomNavigation: BOTTOM_NAVIGATION,
    currentCategory: 0,
    categoryTrackWidth: 0,
    categoryScrollTo: '',
    scrollToView: '',
    loading: true,
    starCoins: 0,
    discount: 0,
    cartSummary: { totalCount: 0, totalPrice: 0, totalCalories: 0 }
  },

  onLoad() {
    this.setupNavigation()
  },

  setupNavigation() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const statusBarHeight = windowInfo.statusBarHeight || 20
      const contentTop = menuButton && menuButton.top ? menuButton.top : statusBarHeight + 6
      const contentHeight = menuButton && menuButton.height ? menuButton.height : 32
      const navigationHeight = contentTop + contentHeight + Math.max(contentTop - statusBarHeight, 6)

      this.setData({
        statusBarHeight,
        navigationHeight,
        navigationContentTop: contentTop,
        navigationContentHeight: contentHeight
      })
    } catch (e) {
      // 保留默认导航尺寸，兼容较低版本基础库。
    }
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onShow() {
    this.hideNativeTabBar()
    this.setData({ starCoins: app.globalData.starCoins })
    this.loadMenuData()
  },

  onHide() {
    this.showNativeTabBar()
  },

  onUnload() {
    this.showNativeTabBar()
  },

  hideNativeTabBar() {
    if (!wx.hideTabBar) return
    wx.hideTabBar({ animation: false })
  },

  showNativeTabBar(callback) {
    if (!wx.showTabBar) {
      if (callback) callback()
      return
    }
    wx.showTabBar({
      animation: false,
      complete: () => {
        if (callback) callback()
      }
    })
  },

  onBottomNavTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'menu') return

    this.showNativeTabBar(() => {
      if (key === 'wishlist') {
        wx.switchTab({ url: '/pages/order/cart/index' })
        return
      }
      if (key === 'record') {
        wx.switchTab({ url: '/pages/order/order-list/index' })
        return
      }
      if (key === 'us') {
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  },

  loadMenuData() {
    const requestId = Date.now()
    this._menuRequestId = requestId
    this.setData({ loading: true })

    Promise.all([cloud.getCategories(), cloud.getMenu()])
      .then(([categoryResponse, menuResponse]) => {
        if (this._menuRequestId !== requestId) return

        const categories = (categoryResponse || []).map(decorateCategory)
        const menuDishMap = (menuResponse && menuResponse.dishes) || {}
        const cart = app.globalData.cart || []
        const dishes = []
        let dishIndex = 0

        categories.forEach(category => {
          const categoryDishes = menuDishMap[category._id] || []
          categoryDishes.forEach(dish => {
            dishes.push(decorateDish(dish, dishIndex, cart))
            dishIndex += 1
          })
        })

        const dishSections = buildDishSections(categories, dishes)
        const cartSummary = summarizeDishes(dishes)

        this.setData({
          categories,
          dishes,
          dishSections,
          currentCategory: 0,
          categoryTrackWidth: categories.length * 134,
          categoryScrollTo: categories[0] ? `side_${categories[0]._id}` : '',
          scrollToView: '',
          loading: false,
          discount: cartSummary.totalPrice >= 80 ? 5 : 0,
          cartSummary
        }, () => {
          setTimeout(() => this.cacheSectionOffsets(), 80)
        })
      })
      .catch(err => {
        if (this._menuRequestId !== requestId) return
        console.error('加载分类和菜单失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '菜单加载失败', icon: 'none' })
      })
  },

  onCategoryTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const category = this.data.categories[index]
    if (!category) return

    const targetView = `dish-section-${category._id}`
    this._tapping = true

    if (this.data.scrollToView === targetView) {
      this.setData({
        currentCategory: index,
        categoryScrollTo: `side_${category._id}`,
        scrollToView: ''
      }, () => this.setData({ scrollToView: targetView }))
    } else {
      this.setData({
        currentCategory: index,
        categoryScrollTo: `side_${category._id}`,
        scrollToView: targetView
      })
    }

    setTimeout(() => {
      this._tapping = false
    }, 450)
  },

  onQuantityTap(e) {
    const id = String(e.currentTarget.dataset.id)
    const delta = Number(e.currentTarget.dataset.delta)
    const dishes = this.data.dishes.map(dish => {
      if (dish._id !== id) return dish
      return Object.assign({}, dish, {
        quantity: Math.max(0, Math.min(9, dish.quantity + delta))
      })
    })
    const dishSections = buildDishSections(this.data.categories, dishes)
    const cartSummary = summarizeDishes(dishes)

    this.setData({
      dishes,
      dishSections,
      discount: cartSummary.totalPrice >= 80 ? 5 : 0,
      cartSummary
    })
  },

  goCheckout() {
    if (this.data.cartSummary.totalCount === 0) {
      wx.showToast({ title: '先选几道喜欢的菜吧', icon: 'none' })
      return
    }

    const currentCart = app.globalData.cart || []
    const selectedItems = this.data.dishes
      .filter(dish => dish.quantity > 0)
      .map(dish => {
        const existing = currentCart.find(item => String(item.dishId) === dish._id)
        return {
          cartItemId: existing ? existing.cartItemId : app.generateId(),
          dishId: dish._id,
          dishName: dish.name,
          coverImage: dish.image,
          unitPrice: dish.price,
          calories: dish.calories,
          quantity: dish.quantity,
          selectedOptions: {},
          extraPrice: 0,
          itemTotal: dish.price * dish.quantity
        }
      })

    app.saveCart(selectedItems)
    wx.navigateTo({ url: '/package-order/pages/checkout/index' })
  },

  onDishTap(e) {
    const { dish } = e.detail
    wx.navigateTo({
      url: `/package-order/pages/dish-detail/index?id=${dish._id}`
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
        url: `/package-order/pages/dish-detail/index?id=${dish._id}`
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
      .selectAll('.dish-section')
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
        this._dishListHeight = container.height
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
        if (this._sectionOffsets[i] <= scrollTop + 12) {
          current = i
        }
      }
      if (this._dishListHeight && scrollTop + this._dishListHeight >= e.detail.scrollHeight - 3) {
        current = this._sectionOffsets.length - 1
      }
      if (current !== this.data.currentCategory) {
        const cat = this.data.categories[current]
        this.setData({
          currentCategory: current,
          categoryScrollTo: cat ? 'side_' + cat._id : ''
        })
      }
    }, 50)
  }
})
