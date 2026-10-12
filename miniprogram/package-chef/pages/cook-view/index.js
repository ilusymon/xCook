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
    loading: true,
    error: '',
    progressError: '',
    busy: false,
  },

  onLoad(options) {
    this._dishId = options.dishId || options.id
    if (options.wishlistId) {
      const itemIndex = Number(options.itemIndex || 0)
      this.setData({ wishlistMode: true, wishlistId: options.wishlistId, itemIndex })
      wx.setNavigationBarTitle({ title: 'Couple Wishlist' })
      if (options.dishId) this.loadDish(options.dishId)
    } else if (options.id) {
      this.loadDish(options.id)
    } else this.setData({ loading: false, error: '缺少菜品信息' })
  },

  onShow() { this._visible = true; this.startWatch() },

  onHide() { this._visible = false; this.stopWatch() },

  startWatch() {
    this.stopWatch()
    if (!this.data.wishlistMode || this._visible === false) return
    this._watcher = cloud.watchWishlistDetail(this.data.wishlistId, 'chef', wishlist => this.setWishlist(wishlist),
      err => this.setData({ progressError: err.message || '制作进度加载失败' }))
  },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  onUnload() {
    this._visible = false
    this.stopWatch()
  },

  setWishlist(wishlist) {
    if (!wishlist) return
    this._wishlist = wishlist
    const item = (wishlist.items || [])[this.data.itemIndex]
    if (!item) {
      this.setData({ progressError: '愿望中的菜品不存在' })
      return
    }
    const steps = this.data.dish.steps || []
    const currentStep = Math.min(item.currentStep || 0, Math.max(steps.length - 1, 0))
    const nextLabel = item.status === 'accepted'
      ? '开始制作'
      : item.status === 'done' ? '已完成 ✓' : steps.length && currentStep < steps.length - 1 ? '完成这一步 ›' : '完成这道菜 ✓'
    this.setData({
      currentStep,
      wishlistStatus: wishlist.status,
      itemStatus: item.status,
      wishlistItem: item,
      nextLabel,
      progressError: ''
    })
  },

  loadDish(dishId) {
    dishId = typeof dishId === 'string' ? dishId : this._dishId
    this.setData({ loading: true, error: '' })
    wx.showLoading({ title: '加载中...' })
    return cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        const item = this.data.wishlistItem
        const currentStep = item
          ? Math.min(item.currentStep || 0, Math.max((res.steps || []).length - 1, 0))
          : this.data.currentStep
        this.setData({ dish: res, currentStep, loading: false, error: '' })
        if (this._wishlist) this.setWishlist(this._wishlist)
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false, error: err.message || '菜品加载失败' })
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
    if (this.data.busy || this.data.loading || this.data.error || this.data.progressError) return
    const { currentStep, dish } = this.data
    if (this.data.wishlistMode) {
      const action = this.data.itemStatus === 'accepted' ? 'start' : 'next'
      if (!['accepted', 'cooking'].includes(this.data.itemStatus)) return
      this.setData({ busy: true })
      this.stopWatch()
      wx.showLoading({ title: '更新中...', mask: true })
      cloud.updateWishlistDishProgress(this.data.wishlistId, this.data.itemIndex, action)
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
        .catch(err => {
          wx.hideLoading()
          wx.showToast({ title: err.message || '更新失败', icon: 'none' })
        })
        .finally(() => { this.setData({ busy: false }); this.startWatch() })
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
      wx.previewMedia({
        sources: [{ url, type: 'video' }],
        fail: () => wx.showToast({ title: '视频无法播放，请检查视频链接', icon: 'none' })
      })
    }
  }
})
