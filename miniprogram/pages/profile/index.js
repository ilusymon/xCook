const app = getApp()
const cloud = require('../../utils/cloud')

const BOTTOM_NAVIGATION = [
  { key: 'menu', label: '菜单', icon: '/images/menu/17_nav_menu.png', width: 53, height: 50 },
  { key: 'wishlist', label: '愿望单', icon: '/images/menu/20_nav_wishlist.png', width: 52, height: 49 },
  { key: 'record', label: '记录', icon: '/images/menu/18_nav_record.png', width: 51, height: 50 },
  { key: 'profile', label: '我的', icon: '/images/menu/19_nav_profile.png', width: 48, height: 41 }
]

function countDishes(menu) {
  return Object.values((menu && menu.dishes) || {}).reduce((total, dishes) => total + dishes.length, 0)
}

function countRecordDays(records) {
  return new Set((records || []).map(record => String(record.occurredAt || '').slice(0, 10)).filter(Boolean)).size
}

function roleLabel(role) {
  if (role === 'chef') return '我是大厨'
  if (role === 'both') return '双重身份'
  return '我是吃货'
}

Page({
  data: {
    statusBarHeight: 20,
    navigationHeight: 64,
    navigationContentTop: 26,
    navigationContentHeight: 32,
    navigationRight: 8,
    ginghamTiles: Array.from({ length: 48 }, (_, index) => index),
    bottomNavigation: BOTTOM_NAVIGATION,
    user: {
      nickName: '小满',
      avatarUrl: '/images/menu/01_chef_girl.png',
      roleLabel: '我是吃货'
    },
    togetherDays: 1,
    orderCount: 0,
    dishCount: 0,
    recordDays: 0
  },

  onLoad() {
    this.setupNavigation()
  },

  onShow() {
    wx.hideTabBar({ animation: false })
    this.loadProfile()
  },

  setupNavigation() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const statusBarHeight = windowInfo.statusBarHeight || 20
      const navigationContentTop = menuButton ? menuButton.top : statusBarHeight + 6
      const navigationContentHeight = menuButton ? menuButton.height : 32
      const navigationRight = menuButton ? windowInfo.windowWidth - menuButton.left + 8 : 8
      this.setData({
        statusBarHeight,
        navigationContentTop,
        navigationContentHeight,
        navigationRight,
        navigationHeight: navigationContentTop + navigationContentHeight + 6
      })
    } catch (e) {}
  },

  loadProfile() {
    const userRequest = app.loadUserInfo().then(() => app.globalData.userInfo)
    Promise.all([
      userRequest,
      cloud.getWishlist('', '', 1, 1).catch(() => null),
      cloud.getMenu('chef').catch(() => null),
      cloud.getFoodRecords().catch(() => null)
    ]).then(([user, wishlists, menu, records]) => {
      user = user || {}
      const createdAt = new Date(user.createdAt)
      const togetherDays = Number.isNaN(createdAt.getTime())
        ? 1
        : Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86400000) + 1)
      this.setData({
        user: {
          nickName: user.nickName || '小满',
          avatarUrl: user.avatarUrl || '/images/menu/01_chef_girl.png',
          roleLabel: roleLabel(user.role)
        },
        togetherDays,
        orderCount: Number((wishlists && wishlists.total) || 0),
        dishCount: countDishes(menu),
        recordDays: countRecordDays(records && records.records)
      })
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goSearch() {
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

  showProfileInfo() {
    wx.showToast({ title: '资料编辑暂未开放', icon: 'none' })
  },

  goDishManage() {
    wx.navigateTo({ url: '/package-chef/pages/dish-manage/index' })
  },

  openNotifications() {
    wx.openSetting({ fail: () => wx.showToast({ title: '暂时无法打开设置', icon: 'none' }) })
  },

  showRelationship() {
    wx.showToast({ title: '情侣关系功能待开放', icon: 'none' })
  },

  onBottomNavTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'profile') return
    if (key === 'menu') wx.switchTab({ url: '/pages/order/menu/index' })
    if (key === 'wishlist') {
      app.globalData.wishlistRole = 'orderer'
      wx.switchTab({ url: '/pages/order/wishlist/index' })
    }
    if (key === 'record') wx.switchTab({ url: '/pages/order/records/index' })
  }
})
