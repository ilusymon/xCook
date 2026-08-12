const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    pendingCount: 0,
    todayCount: 0,
    dishCount: 0
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    // 获取待处理愿望数
    cloud.getWishlist('chef', 'active', 1, 1).then(res => {
      if (res) {
        this.setData({ pendingCount: res.total || 0 })
      }
    })

    // 获取愿望单总数
    cloud.getWishlist('chef', '', 1, 1).then(res => {
      if (res) {
        this.setData({ todayCount: res.total || 0 })
      }
    })

    // 获取菜品总数
    cloud.getMenu('chef').then(res => {
      if (res && res.dishes) {
        let count = 0
        Object.values(res.dishes).forEach(arr => { count += arr.length })
        this.setData({ dishCount: count })
      }
    })
  },

  goDishManage() {
    wx.navigateTo({ url: '/package-chef/pages/dish-manage/index' })
  },

  goAddDish() {
    wx.navigateTo({ url: '/package-chef/pages/dish-edit/index' })
  },

  goOrderManage() {
    this.goWishlist()
  },

  goWishlist() {
    app.globalData.wishlistRole = 'chef'
    wx.switchTab({ url: '/pages/order/wishlist/index' })
  },

  goCategoryManage() {
    wx.navigateTo({ url: '/package-chef/pages/category-manage/index' })
  }
})
