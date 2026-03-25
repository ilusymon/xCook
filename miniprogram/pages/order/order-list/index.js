const cloud = require('../../../utils/cloud')
const { formatDate } = require('../../../utils/format')

Page({
  data: {
    tabs: [
      { label: '全部', value: '' },
      { label: '进行中', value: 'active' },
      { label: '已完成', value: 'done' }
    ],
    currentTab: 0,
    orders: [],
    page: 1,
    hasMore: true
  },

  onShow() {
    this.setData({ orders: [], page: 1, hasMore: true })
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.setData({ orders: [], page: 1, hasMore: true })
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset
    this.setData({
      currentTab: index,
      orders: [],
      page: 1,
      hasMore: true
    })
    this.loadOrders()
  },

  loadOrders() {
    const status = this.data.tabs[this.data.currentTab].value
    return cloud.getOrders('orderer', status, this.data.page).then(res => {
      if (res && res.orders) {
        const orders = res.orders.map(order => ({
          ...order,
          createdAtText: formatDate(order.createdAt)
        }))
        this.setData({
          orders: [...this.data.orders, ...orders],
          hasMore: res.hasMore || false
        })
      }
    })
  },

  loadMore() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 })
      this.loadOrders()
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order/order-detail/index?id=${id}` })
  }
})
