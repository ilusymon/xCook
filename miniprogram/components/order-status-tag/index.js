const { ORDER_STATUS_TEXT, ORDER_STATUS_COLOR } = require('../../utils/constants')

Component({
  properties: {
    status: { type: String, value: 'placed' }
  },

  observers: {
    status(val) {
      const colorMap = {
        placed: { bg: '#FFF3E6', text: '#FF9F43' },
        accepted: { bg: '#E8F0FF', text: '#54A0FF' },
        cooking: { bg: '#FFE8E8', text: '#FF6B6B' },
        done: { bg: '#E8F8E8', text: '#5FD068' },
        cancelled: { bg: '#F0F0F0', text: '#B0B0B0' }
      }
      const colors = colorMap[val] || colorMap.placed
      this.setData({
        statusText: ORDER_STATUS_TEXT[val] || val,
        bgColor: colors.bg,
        textColor: colors.text
      })
    }
  },

  data: {
    statusText: '',
    bgColor: '',
    textColor: ''
  }
})
