Component({
  properties: {
    dish: {
      type: Object,
      value: {}
    },
    showAddButton: {
      type: Boolean,
      value: true
    }
  },

  data: {
    coverLoaded: false
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { dish: this.data.dish })
    },

    onAdd() {
      this.triggerEvent('add', { dish: this.data.dish })
    },

    onCoverLoad() {
      this.setData({ coverLoaded: true })
    }
  }
})
