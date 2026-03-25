const cloud = require('../../../utils/cloud')
const { formatDate } = require('../../../utils/format')

Page({
  data: {
    tabs: [
      { label: '新订单', value: 'placed', count: 0 },
      { label: '制作中', value: 'cooking', count: 0 },
      { label: '已完成', value: 'done', count: 0 }
    ],
    currentTab: 0,
    orders: []
  },

  _watcher: null,

  onShow() {
    this.loadOrders()
    this.startWatch()
  },

  onHide() {
    this.stopWatch()
  },

  onUnload() {
    this.stopWatch()
  },

  startWatch() {
    this._watcher = cloud.watchNewOrders((orders) => {
      // 更新新订单数量
      this.setData({ 'tabs[0].count': orders.length })
      // 如果当前在新订单标签，刷新列表
      if (this.data.currentTab === 0) {
        this.loadOrders()
      }
    })
  },

  stopWatch() {
    if (this._watcher) {
      this._watcher.close()
      this._watcher = null
    }
  },

  onTabChange(e) {
    this.setData({
      currentTab: e.currentTarget.dataset.index,
      orders: []
    })
    this.loadOrders()
  },

  loadOrders() {
    const status = this.data.tabs[this.data.currentTab].value
    // 对于 "制作中" tab，需要包含 accepted 和 cooking
    const queryStatus = status === 'cooking' ? 'active' : status
    cloud.getOrders('chef', queryStatus).then(res => {
      if (res && res.orders) {
        const orders = res.orders.map(order => ({
          ...order,
          createdAtText: formatDate(order.createdAt)
        }))
        this.setData({ orders })
      }
    })
  },

  acceptOrder(e) {
    const id = e.currentTarget.dataset.id
    this.updateStatus(id, 'accepted', '已接单')
  },

  startCooking(e) {
    const id = e.currentTarget.dataset.id
    this.updateStatus(id, 'cooking', '开始制作')
  },

  markDone(e) {
    const id = e.currentTarget.dataset.id
    this.updateStatus(id, 'done', '已完成')
  },

  updateStatus(orderId, newStatus, message) {
    wx.showLoading({ title: '更新中...' })
    cloud.updateOrderStatus(orderId, newStatus).then(res => {
      wx.hideLoading()
      if (res && res.success) {
        wx.showToast({ title: message, icon: 'success' })
        this.loadOrders()
      } else {
        wx.showToast({ title: '更新失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '更新失败', icon: 'none' })
    })
  }
})
