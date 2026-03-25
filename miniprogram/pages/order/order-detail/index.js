const app = getApp()
const cloud = require('../../../utils/cloud')
const { formatFullDate } = require('../../../utils/format')
const { ORDER_STATUS_STEP } = require('../../../utils/constants')

Page({
  data: {
    order: {},
    stepIndex: 0,
    createdAtText: ''
  },

  _watcher: null,

  onLoad(options) {
    if (options.id) {
      this.loadOrder(options.id)
      this.watchOrder(options.id)
    }
  },

  onUnload() {
    if (this._watcher) {
      this._watcher.close()
    }
  },

  loadOrder(orderId) {
    cloud.callFunction('getOrders', { orderId }).then(res => {
      if (res && res.order) {
        this.setOrderData(res.order)
      }
    })
  },

  watchOrder(orderId) {
    this._watcher = cloud.watchOrder(orderId, (order) => {
      this.setOrderData(order)
    })
  },

  setOrderData(order) {
    // 处理选项标签
    if (order.items) {
      order.items = order.items.map(item => {
        const optionTags = []
        if (item.selectedOptions) {
          item.selectedOptions.forEach(opt => {
            if (opt.selected) {
              opt.selected.forEach(v => optionTags.push(v))
            }
          })
        }
        return { ...item, optionTags }
      })
    }

    this.setData({
      order,
      stepIndex: ORDER_STATUS_STEP[order.status] || 0,
      createdAtText: formatFullDate(order.createdAt)
    })
  },

  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '取消后星星币将退回，确定取消吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' })
          cloud.updateOrderStatus(this.data.order._id, 'cancelled').then(res => {
            wx.hideLoading()
            if (res && res.success) {
              app.globalData.starCoins += this.data.order.totalPrice
              wx.showToast({ title: '已取消', icon: 'success' })
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '取消失败', icon: 'none' })
          })
        }
      }
    })
  }
})
