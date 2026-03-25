const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    categories: [],
    dishMap: {}
  },

  onShow() {
    this.loadMenu()
  },

  loadMenu() {
    wx.showLoading({ title: '加载中...' })
    cloud.getMenu('chef').then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({
          categories: res.categories || [],
          dishMap: res.dishes || {}
        })
      }
    }).catch(() => {
      wx.hideLoading()
    })
  },

  addDish() {
    wx.navigateTo({ url: '/pages/chef/dish-edit/index' })
  },

  editDish(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/chef/dish-edit/index?id=${id}` })
  },

  viewCook(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/chef/cook-view/index?id=${id}` })
  },

  toggleAvailable(e) {
    const id = e.currentTarget.dataset.id
    const available = !e.currentTarget.dataset.available
    cloud.saveDish({ _id: id, isAvailable: available }).then(() => {
      wx.showToast({ title: available ? '已上架' : '已下架', icon: 'success' })
    })
  },

  deleteDish(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除菜品',
      content: `确定删除「${name}」吗？`,
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          cloud.deleteDish(id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadMenu()
          })
        }
      }
    })
  }
})
