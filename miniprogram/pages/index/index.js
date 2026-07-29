// 首页主题可配置为 blue 或 yellow，默认 blue。
const HOME_THEME = 'blue'

Page({
  data: {
    homeTheme: HOME_THEME
  },

  goOrder() {
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

  goChef() {
    wx.switchTab({ url: '/pages/chef/dashboard/index' })
  },

  goOrders() {
    wx.switchTab({ url: '/pages/order/order-list/index' })
  },

  showPending() {
    wx.showToast({
      title: '待开发',
      icon: 'none'
    })
  }
})
