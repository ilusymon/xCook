Component({
  properties: { active: { type: String, value: 'menu' } },
  data: {
    items: [
      { key: 'menu', label: '菜单', path: '/pages/order/menu/index' },
      { key: 'wishlist', label: '愿望单', path: '/pages/order/wishlist/index' },
      { key: 'record', label: '记录', path: '/pages/order/records/index' },
      { key: 'profile', label: '我的', path: '/pages/profile/index' }
    ]
  },
  methods: {
    navigate(e) {
      const item = this.data.items[e.currentTarget.dataset.index]
      if (!item) return
      getApp().globalData.wishlistRole = 'orderer'
      wx.switchTab({ url: item.path })
    }
  }
})
