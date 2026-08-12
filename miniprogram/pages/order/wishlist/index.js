const app = getApp()
const cloud = require('../../../utils/cloud')

const FALLBACKS = [
  '/images/menu/09_dish_pasta.png',
  '/images/menu/14_dish_cake.png',
  '/images/menu/13_dish_bubble_tea.png'
]

const BOTTOM_NAVIGATION = [
  { key: 'menu', label: '菜单', icon: '/images/menu/17_nav_menu.png', width: 53, height: 50 },
  { key: 'wishlist', label: '愿望单', icon: '/images/menu/20_nav_wishlist.png', width: 52, height: 49 },
  { key: 'record', label: '记录', icon: '/images/menu/18_nav_record.png', width: 51, height: 50 },
  { key: 'profile', label: '我的', icon: '/images/menu/19_nav_profile.png', width: 48, height: 41 }
]

function decorate(item, index, isChef) {
  const dishes = item.items || []
  const primary = dishes[0] || {}
  const totalCount = dishes.reduce((sum, dish) => sum + Number(dish.quantity || 0), 0)
  const statusCopy = {
    placed: '待大厨接下愿望',
    accepted: '大厨已接下，等待制作',
    cooking: '大厨正在制作中',
    done: '愿望已完成，快去享用吧',
    cancelled: '愿望已取消'
  }
  const actionCopy = isChef
    ? { placed: '接下愿望', accepted: '开始制作', cooking: '继续制作', done: '已完成', cancelled: '已取消' }
    : { placed: '查看愿望', accepted: '查看进度', cooking: '查看进度', done: '查看回忆', cancelled: '查看详情' }

  return {
    ...item,
    coverImage: primary.coverImage || FALLBACKS[index % FALLBACKS.length],
    displayName: dishes.length > 1 ? `${primary.dishName} 等 ${dishes.length} 道` : (primary.dishName || '一份甜蜜愿望'),
    itemSummary: `共 ${totalCount} 份 · ${item.totalCalories || 0} kcal`,
    statusText: statusCopy[item.status] || item.status,
    actionText: actionCopy[item.status] || '查看',
    remainingText: item.note ? `备注：${item.note}` : '',
    actionClass: item.status === 'placed' ? 'waiting' : item.status,
    disabled: isChef && (item.status === 'done' || item.status === 'cancelled')
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 64,
    navigationContentTop: 26,
    navigationContentHeight: 32,
    items: [],
    loading: true,
    isChef: false,
    title: '我们的愿望单',
    subtitle: '菜单点来的菜，会在这里等大厨～',
    ginghamTiles: Array.from({ length: 48 }, (_, index) => index),
    bottomNavigation: BOTTOM_NAVIGATION
  },

  onLoad() {
    this.setupNavigation()
  },

  onShow() {
    wx.hideTabBar({ animation: false })
    const isChef = app.globalData.wishlistRole === 'chef'
    this.setData({
      isChef,
      title: isChef ? '愿望单制作' : '我们的愿望单',
      subtitle: isChef ? '看看今天想吃什么，开始为她制作吧～' : '菜单点来的菜，会在这里等大厨～',
      loading: true
    })
    this.startWatch()
  },

  onHide() {
    this.stopWatch()
  },

  onUnload() {
    this.stopWatch()
  },

  setupNavigation() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const statusBarHeight = windowInfo.statusBarHeight || 20
      const navigationContentTop = menuButton ? menuButton.top : statusBarHeight + 6
      const navigationContentHeight = menuButton ? menuButton.height : 32
      this.setData({
        statusBarHeight,
        navigationContentTop,
        navigationContentHeight,
        navigationHeight: navigationContentTop + navigationContentHeight + 6
      })
    } catch (e) {}
  },

  startWatch() {
    this.stopWatch()
    const role = this.data.isChef ? 'chef' : ''
    this._watcher = cloud.watchWishlist(role, wishlists => {
      this.setData({
        items: (wishlists || []).map((item, index) => decorate(item, index, this.data.isChef)),
        loading: false
      })
    })
  },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  onAction(e) {
    const item = this.data.items[e.currentTarget.dataset.index]
    if (!item || item.disabled) return
    if (!this.data.isChef) {
      wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}` })
      return
    }
    if (item.status === 'placed') {
      cloud.updateWishlistStatus(item._id, 'accepted')
        .then(() => wx.showToast({ title: '已接下愿望', icon: 'success' }))
        .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
      return
    }
    wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}&role=chef` })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goMenu() {
    app.globalData.wishlistRole = 'orderer'
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

  onBottomNavTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'wishlist') return
    if (key === 'menu') wx.switchTab({ url: '/pages/order/menu/index' })
    if (key === 'record') wx.switchTab({ url: '/pages/order/records/index' })
    if (key === 'profile') wx.switchTab({ url: '/pages/profile/index' })
  }
})
