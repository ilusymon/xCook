const cloud = require('../../../utils/cloud')

Page({
  data: {
    dish: {
      materials: [],
      steps: []
    },
    currentStep: 0,
    wishlistMode: false,
    wishlistId: '',
    itemIndex: 0,
    wishlistStatus: '',
    itemStatus: '',
    wishlistItem: null,
    nextLabel: '下一步 ›',
    ginghamTiles: Array.from({ length: 48 }, (_, index) => index)
  },

  onLoad(options) {
    if (options.wishlistId) {
      const itemIndex = Number(options.itemIndex || 0)
      this.setData({ wishlistMode: true, wishlistId: options.wishlistId, itemIndex })
      wx.setNavigationBarTitle({ title: 'Couple Wishlist' })
      if (options.dishId) this.loadDish(options.dishId)
      this._watcher = cloud.watchWishlistDetail(options.wishlistId, 'chef', wishlist => this.setWishlist(wishlist))
    } else if (options.id) {
      this.loadDish(options.id)
    }
  },

  onUnload() {
    if (this._watcher) this._watcher.close()
  },

  setWishlist(wishlist) {
    if (!wishlist) return
    const item = (wishlist.items || [])[this.data.itemIndex]
    if (!item) return
    const steps = this.data.dish.steps || []
    const currentStep = Math.min(item.currentStep || 0, Math.max(steps.length - 1, 0))
    const nextLabel = item.status === 'accepted'
      ? '开始制作'
      : item.status === 'done' ? '已完成 ✓' : '完成这一步 ›'
    this.setData({
      currentStep,
      wishlistStatus: wishlist.status,
      itemStatus: item.status,
      wishlistItem: item,
      nextLabel
    })
  },

  loadDish(dishId) {
    wx.showLoading({ title: '加载中...' })
    cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        const item = this.data.wishlistItem
        const currentStep = item
          ? Math.min(item.currentStep || 0, Math.max((res.steps || []).length - 1, 0))
          : this.data.currentStep
        this.setData({ dish: res, currentStep })
      }
    })
  },

  goToStep(e) {
    if (this.data.wishlistMode) return
    this.setData({ currentStep: e.currentTarget.dataset.index })
  },

  prevStep() {
    if (this.data.wishlistMode) return
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 })
    }
  },

  nextStep() {
    const { currentStep, dish } = this.data
    if (this.data.wishlistMode) {
      const action = this.data.itemStatus === 'accepted' ? 'start' : 'next'
      if (this.data.itemStatus === 'done') return
      wx.showLoading({ title: '更新中...' })
      cloud.updateWishlistDishProgress(this.data.wishlistId, this.data.itemIndex, action)
        .then(() => cloud.getWishlistDetail(this.data.wishlistId, 'chef'))
        .then(res => {
          wx.hideLoading()
          this.setWishlist(res.wishlist)
          const item = res.wishlist.items[this.data.itemIndex]
          wx.showToast({
            title: item.status === 'done' ? '这道菜完成啦！' : action === 'start' ? '开始制作' : '进度已更新',
            icon: 'success'
          })
          if (item.status === 'done') setTimeout(() => wx.navigateBack(), 900)
        })
        .catch(() => {
          wx.hideLoading()
          wx.showToast({ title: '更新失败', icon: 'none' })
        })
      return
    }
    if (currentStep < dish.steps.length - 1) {
      this.setData({ currentStep: currentStep + 1 })
    } else {
      // 已完成
      wx.showToast({ title: '烹饪完成！', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  playVideo() {
    const url = this.data.dish.videoUrl
    if (url) {
      // 如果是网页链接则用 web-view 或视频组件
      wx.previewMedia({
        sources: [{ url, type: 'video' }]
      })
    }
  }
})
