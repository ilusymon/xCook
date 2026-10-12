const cloud = require('../../../utils/cloud')
const { formatDate, formatCartItem } = require('../../../utils/format')

Page({
  data: {
    tabs: [
      { label: '新愿望', value: 'placed' },
      { label: '待制作', value: 'accepted' },
      { label: '制作中', value: 'cooking' },
      { label: '已完成', value: 'done' },
      { label: '已取消', value: 'cancelled' }
    ],
    currentTab: 0,
    orders: [],
    loading: true,
    error: '',
    pageSize: 20,
    hasMore: false,
    total: 0,
    busy: false
  },

  onLoad(options) {
    const index = this.data.tabs.findIndex(tab => tab.value === options.tab)
    if (index >= 0) this.setData({ currentTab: index })
  },

  onShow() { this._visible = true; this.loadOrders() },
  onHide() { this._visible = false; this.stopWatch() },
  onUnload() { this._visible = false; this.stopWatch() },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  onTabChange(e) {
    this.setData({ currentTab: Number(e.currentTarget.dataset.index), orders: [], pageSize: 20 })
    this.loadOrders()
  },

  loadOrders() {
    this.stopWatch()
    if (this._visible === false) return
    this.setData({ loading: true, error: '' })
    this._watcher = cloud.watchWishlist('chef', (orders, res) => {
      this.setData({
        orders: orders.map(order => ({ ...order, createdAtText: formatDate(order.createdAt), items: order.items.map((item, itemIndex) => ({ ...formatCartItem(item), itemIndex })) })),
        loading: false,
        error: '',
        total: res.total || 0,
        hasMore: !!res.hasMore
      })
    }, err => this.setData({ loading: false, error: err.message || '愿望单加载失败' }),
    this.data.tabs[this.data.currentTab].value, this.data.pageSize)
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ pageSize: this.data.pageSize + 20 })
    this.loadOrders()
  },

  openOrder(e) {
    const order = this.data.orders[Number(e.currentTarget.dataset.index)]
    if (!order) return
    wx.navigateTo({ url: '/package-order/pages/wishlist-detail/index?id=' + order._id + '&role=chef' })
  },

  acceptOrder(e) {
    const order = this.data.orders[Number(e.currentTarget.dataset.index)]
    if (!order || !order._id || this.data.busy) return
    this.setData({ busy: true })
    wx.showLoading({ title: '接下愿望中...', mask: true })
    cloud.updateWishlistStatus(order._id, 'accepted').then(() => {
      wx.hideLoading()
      this.loadOrders()
      this.openOrder(e)
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '接单失败', icon: 'none' })
    }).finally(() => this.setData({ busy: false }))
  }
})
