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
    ginghamTiles: Array.from({ length: 48 }, (_, index) => index),
    wishlist: { items: [] },
    statusStep: 0,
    statusText: '',
    updatedText: '',
    isChef: false
  },

  onLoad(options) {
    if (!options.id) return
    const isChef = options.role === 'chef'
    this.setData({ isChef })
    this._watcher = cloud.watchWishlistDetail(options.id, isChef ? 'chef' : '', wishlist => this.setWishlist(wishlist))
  },

  onUnload() {
    if (this._watcher) this._watcher.close()
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
        canCook: this.data.isChef && ['accepted', 'cooking'].includes(status)
      }
    })
    this.setData({
      wishlist: { ...wishlist, items },
      statusStep: Object.prototype.hasOwnProperty.call(STATUS_STEP, wishlist.status) ? STATUS_STEP[wishlist.status] : 0,
      statusText: STATUS_TEXT[wishlist.status] || wishlist.status,
      updatedText: formatDate(wishlist.updatedAt)
    })
  },

  goBack() { wx.navigateBack() },

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
    wx.showLoading({ title: '更新中...' })
    cloud.updateWishlistStatus(this.data.wishlist._id, status)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: message, icon: 'success' })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '更新失败', icon: 'none' })
      })
  },

  openDish(e) {
    const item = this.data.wishlist.items[e.currentTarget.dataset.index]
    if (!item || !item.canCook) return
    wx.navigateTo({
      url: `/package-chef/pages/cook-view/index?wishlistId=${this.data.wishlist._id}&itemIndex=${item.index}&dishId=${item.dishId}`
    })
  },

  cheer() { wx.showToast({ title: '加油已经送达大厨 ♡', icon: 'none' }) }
})
