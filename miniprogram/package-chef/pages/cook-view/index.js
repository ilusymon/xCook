const cloud = require('../../../utils/cloud')

Page({
  data: {
    dish: {
      materials: [],
      steps: []
    },
    currentStep: 0
  },

  onLoad(options) {
    if (options.id) {
      this.loadDish(options.id)
    }
  },

  loadDish(dishId) {
    wx.showLoading({ title: '加载中...' })
    cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        this.setData({ dish: res })
      }
    })
  },

  goToStep(e) {
    this.setData({ currentStep: e.currentTarget.dataset.index })
  },

  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 })
    }
  },

  nextStep() {
    const { currentStep, dish } = this.data
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
      // 如果是网页链接则用 web-view 或视频组件
      wx.previewMedia({
        sources: [{ url, type: 'video' }]
      })
    }
  }
})
