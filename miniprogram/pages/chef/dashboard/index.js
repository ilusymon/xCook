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
    // 获取待处理订单数
    cloud.getOrders('chef', 'active', 1, 1).then(res => {
      if (res) {
        this.setData({ pendingCount: res.total || 0 })
      }
    })

    // 获取今日订单数
    cloud.getOrders('chef', '', 1, 1).then(res => {
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
    wx.navigateTo({ url: '/pages/chef/dish-manage/index' })
  },

  goAddDish() {
    wx.navigateTo({ url: '/pages/chef/dish-edit/index' })
  },

  goOrderManage() {
    wx.navigateTo({ url: '/pages/chef/order-manage/index' })
  }
})
