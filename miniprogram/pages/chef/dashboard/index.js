const cloud = require('../../../utils/cloud')

Page({
  data: {
    pendingCount: 0,
    cookingCount: 0,
    dishCount: 0,
    requests: [],
    busy: false,
    loading: false,
    error: ''
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    this.setData({ loading: true, error: '' })
    return Promise.all([
      cloud.getWishlist('chef', 'placed', 1, 1),
      cloud.getWishlist('chef', 'cooking', 1, 1),
      cloud.getMenu('chef'),
      cloud.getWishlist('chef', 'active', 1, 2)
    ])
      .then(([pending, cooking, menu, active]) => this.setData({
        pendingCount: pending.total || 0,
        cookingCount: cooking.total || 0,
        dishCount: Object.values(menu.dishes || {}).reduce((total, items) => total + items.length, 0),
        requests: (active.wishlists || []).map(item => ({ ...item,
          previewItems: (item.items || []).slice(0, 2),
          statusText: { placed: '等待接下', accepted: '等待制作', cooking: '制作中' }[item.status]
        })),
        loading: false
      }))
      .catch(err => this.setData({ loading: false, error: err.message || '厨房信息加载失败' }))
  },

  openRequest(e) {
    const item = this.data.requests[e.currentTarget.dataset.index]
    if (!item || this.data.busy) return
    const open = () => wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}&role=chef` })
    if (item.status !== 'placed') return open()
    this.setData({ busy: true })
    return cloud.updateWishlistStatus(item._id, 'accepted').then(open)
      .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }))
      .finally(() => this.setData({ busy: false }))
  },

  goHome() { wx.reLaunch({ url: '/pages/index/index' }) },

  goMenu() { wx.switchTab({ url: '/pages/order/menu/index' }) },

  goDishManage() {
    wx.navigateTo({ url: '/package-chef/pages/dish-manage/index' })
  },

  goAddDish() {
    wx.navigateTo({ url: '/package-chef/pages/dish-edit/index' })
  },

  goOrderManage() {
    wx.navigateTo({ url: '/package-chef/pages/order-manage/index' })
  },

  goWishlist() {
    wx.navigateTo({ url: '/package-chef/pages/order-manage/index?tab=cooking' })
  },

  goCategoryManage() {
    wx.navigateTo({ url: '/package-chef/pages/category-manage/index' })
  }
})
