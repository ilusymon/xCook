Component({
  properties: {
    coverImage: { type: String, value: '' },
    dishName: { type: String, value: '' },
    mode: { type: String, value: 'aspectFill' }
  },
  data: { failed: false, artIndex: -1 },
  observers: {
    'coverImage, dishName'(coverImage, dishName) {
      const artIndex = /牛腩/.test(dishName) ? 0 : /蛋烧|玉子|厚蛋/.test(dishName) ? 1 : /排骨汤|玉米汤/.test(dishName) ? 2 : -1
      this.setData({ failed: false, artIndex })
    }
  },
  methods: { imageError() { this.setData({ failed: true }) } }
})
