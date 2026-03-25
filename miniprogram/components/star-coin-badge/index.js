Component({
  properties: {
    balance: { type: Number, value: 0 }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap')
    }
  }
})
