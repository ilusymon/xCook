const cloud = require('../../../utils/cloud')

Page({
  data: {
    categories: [],
    dishMap: {},
    loading: false,
    error: '',
    busy: false
  },

  onShow() {
    this.loadMenu()
  },

  loadMenu() {
    this.setData({ loading: true, error: '' })
    wx.showLoading({ title: '加载中...' })
    return cloud.getMenu('chef').then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({
          categories: res.categories || [],
          dishMap: res.dishes || {},
          loading: false
        })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false, error: err.message || '菜品加载失败' })
    })
  },

  addDish() {
    wx.navigateTo({ url: '/package-chef/pages/dish-edit/index' })
  },

  editDish(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-chef/pages/dish-edit/index?id=${id}` })
  },

  viewCook(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-chef/pages/cook-view/index?id=${id}` })
  },

  toggleAvailable(e) {
    if (this.data.busy) return
    const id = e.currentTarget.dataset.id
    const available = e.detail.value
    this.setData({ busy: true })
    cloud.saveDish({ _id: id, isAvailable: available }).then(() => {
      wx.showToast({ title: available ? '已上架' : '已下架', icon: 'success' })
      return this.loadMenu()
    }).catch(err => {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
      this.loadMenu()
    }).finally(() => this.setData({ busy: false }))
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
          }).catch(err => wx.showToast({ title: err.message || '删除失败', icon: 'none' }))
        }
      }
    })
  }
})
