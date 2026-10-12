const cloud = require('../../../utils/cloud')
const { formatDate } = require('../../../utils/format')

const STATUS_STEP = { placed: 0, accepted: 1, cooking: 2, done: 3, cancelled: -1 }
const STATUS_TEXT = {
  placed: '等待大厨接下',
  accepted: '大厨已接下',
  cooking: '正在制作',
  done: '愿望已完成',
  cancelled: '愿望已取消'
}

Page({
  data: {
    wishlist: { items: [] },
    statusStep: 0,
    statusText: '',
    updatedText: '',
    isChef: false,
    loading: true,
    error: '',
    busy: false
  },

  onLoad(options) {
    this._wishlistId = options.id
    if (!options.id) {
      this.setData({ loading: false, error: '缺少愿望单信息，请返回重试' })
      return
    }
    const isChef = options.role === 'chef'
    this.setData({ isChef })
  },

  onShow() { this._visible = true; this.startWatch() },

  onHide() { this._visible = false; this.stopWatch() },

  startWatch() {
    this.stopWatch()
    if (!this._wishlistId || this._visible === false) return
    this._watcher = cloud.watchWishlistDetail(this._wishlistId, this.data.isChef ? 'chef' : '',
      wishlist => this.setWishlist(wishlist), err => this.setData({ loading: false, error: err.message || '进度加载失败' }))
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
    const items = (wishlist.items || []).map((item, index) => {
      const optionTags = []
      Object.keys(item.selectedOptions || {}).forEach(groupName => {
        const values = item.selectedOptions[groupName] || []
        values.forEach(value => optionTags.push(value))
      })
      const status = item.status || (wishlist.status === 'placed' ? 'pending' : wishlist.status)
      return {
        ...item,
        index,
        optionTags,
        status,
        statusText: STATUS_TEXT[status] || (status === 'pending' ? '等待接下' : status),
        canCook: this.data.isChef && ['accepted', 'cooking'].includes(wishlist.status) && ['accepted', 'cooking'].includes(status)
      }
    })
    this.setData({
      loading: false,
      error: '',
      wishlist: { ...wishlist, items },
      statusStep: Object.prototype.hasOwnProperty.call(STATUS_STEP, wishlist.status) ? STATUS_STEP[wishlist.status] : 0,
      statusText: STATUS_TEXT[wishlist.status] || wishlist.status,
      updatedText: formatDate(wishlist.updatedAt)
    })
  },

  goBack() {
    getApp().globalData.wishlistRole = this.data.isChef ? 'chef' : 'orderer'
    wx.switchTab({ url: '/pages/order/wishlist/index' })
  },

  acceptWishlist() {
    this.updateStatus('accepted', '已接下愿望')
  },

  cancelWishlist() {
    wx.showModal({
      title: '取消愿望',
      content: '确定取消这份愿望单吗？',
      confirmColor: '#FF6B81',
      success: res => {
        if (res.confirm) this.updateStatus('cancelled', '愿望已取消')
      }
    })
  },

  updateStatus(status, message) {
    if (this.data.busy || !this.data.wishlist._id) return
    this.setData({ busy: true })
    this.stopWatch()
    wx.showLoading({ title: '更新中...', mask: true })
    cloud.updateWishlistStatus(this.data.wishlist._id, status)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: message, icon: 'success' })
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '更新失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ busy: false })
        this.startWatch()
      })
  },

  openDish(e) {
    const item = this.data.wishlist.items[e.currentTarget.dataset.index]
    if (!item || !item.canCook) return
    wx.navigateTo({
      url: `/package-chef/pages/cook-view/index?wishlistId=${this.data.wishlist._id}&itemIndex=${item.index}&dishId=${item.dishId}`
    })
  },

  refreshProgress() {
    this.setData({ loading: true, error: '' })
    this.startWatch()
  }
})
