Page({
  goOrder() { wx.switchTab({ url: '/pages/order/menu/index' }) },
  goChef() { wx.navigateTo({ url: '/pages/chef/dashboard/index' }) },
  goOrders() { wx.switchTab({ url: '/pages/order/records/index' }) },
  goWishlist() {
    getApp().globalData.wishlistRole = 'orderer'
    wx.switchTab({ url: '/pages/order/wishlist/index' })
  }
})
