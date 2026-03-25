const app = getApp()

Page({
  data: {
    starCoins: 0
  },

  onShow() {
    this.setData({
      starCoins: app.globalData.starCoins || 0
    })
  },

  goOrder() {
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

  goChef() {
    wx.switchTab({ url: '/pages/chef/dashboard/index' })
  }
})
