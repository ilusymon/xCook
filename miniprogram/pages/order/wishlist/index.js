const app = getApp()
const cloud = require('../../../utils/cloud')
const { formatCartItem, formatDate } = require('../../../utils/format')

function decorate(item, isChef) {
  const dishes = item.items || []
  const totalCount = dishes.reduce((sum, dish) => sum + Number(dish.quantity || 0), 0)
  const statusCopy = {
    placed: '等待大厨',
    accepted: '大厨已接下',
    cooking: '制作中',
    done: '已完成',
    cancelled: '已取消'
  }
  const actionCopy = isChef
    ? { placed: '接下愿望', accepted: '开始制作', cooking: '继续制作', done: '查看详情', cancelled: '查看详情' }
    : { placed: '查看愿望', accepted: '查看制作进度', cooking: '查看制作进度', done: '查看回忆', cancelled: '查看详情' }

  return {
    ...item,
    items: dishes.map(formatCartItem),
    createdText: formatDate(item.createdAt),
    statusStep: ['placed', 'accepted', 'cooking', 'done'].indexOf(item.status),
    itemSummary: `共 ${totalCount} 份 · ${item.totalCalories || 0} kcal`,
    statusText: statusCopy[item.status] || item.status,
    actionText: actionCopy[item.status] || '查看'
  }
}

Page({
  data: {
    items: [],
    loading: true,
    isChef: false,
    title: '我们的愿望单',
    progressLabels: ['已许愿', '已接下', '制作中', '已完成'],
    error: '',
    filters: [{ label: '全部', value: '' }, { label: '进行中', value: 'active' }, { label: '已完成', value: 'done' }, { label: '已取消', value: 'cancelled' }],
    currentStatus: '',
    pageSize: 20,
    total: 0,
    hasMore: false,
    busy: false
  },

  onShow() {
    this._visible = true
    wx.hideTabBar({ animation: false })
    const isChef = app.globalData.wishlistRole === 'chef'
    this.setData({
      isChef,
      title: isChef ? '愿望单制作' : '我们的愿望单',
      loading: true,
      error: ''
    })
    this.startWatch()
  },

  onHide() {
    this._visible = false
    this.stopWatch()
  },

  onUnload() {
    this._visible = false
    this.stopWatch()
  },

  startWatch() {
    this.stopWatch()
    if (this._visible === false) return
    const role = this.data.isChef ? 'chef' : ''
    this._watcher = cloud.watchWishlist(role, (wishlists, res) => {
      this.setData({
        items: (wishlists || []).map(item => decorate(item, this.data.isChef)),
        loading: false,
        error: '',
        total: res.total || 0,
        hasMore: !!res.hasMore
      })
    }, err => this.setData({ loading: false, error: err.message || '愿望单加载失败' }), this.data.currentStatus, this.data.pageSize)
  },

  changeFilter(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.value, pageSize: 20, items: [], loading: true, error: '' })
    this.startWatch()
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ pageSize: this.data.pageSize + 20, loading: true })
    this.startWatch()
  },

  switchRole(e) {
    app.globalData.wishlistRole = e.currentTarget.dataset.role
    this.setData({ currentStatus: '', pageSize: 20, items: [] })
    this.onShow()
  },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  onAction(e) {
    const item = this.data.items[e.currentTarget.dataset.index]
    if (!item || this.data.busy) return
    if (!this.data.isChef) {
      wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}` })
      return
    }
    if (item.status === 'placed') {
      this.setData({ busy: true })
      cloud.updateWishlistStatus(item._id, 'accepted')
        .then(() => wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}&role=chef` }))
        .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }))
        .finally(() => this.setData({ busy: false }))
      return
    }
    wx.navigateTo({ url: `/package-order/pages/wishlist-detail/index?id=${item._id}&role=chef` })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goMenu() {
    app.globalData.wishlistRole = 'orderer'
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

})
