Component({
  methods: {
    goHome() {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  }
})
