Component({
  properties: {
    materials: { type: Array, value: [] },
    interactive: { type: Boolean, value: false }
  },

  data: {
    checkedMap: {}
  },

  methods: {
    onToggle(e) {
      if (!this.data.interactive) return
      const index = e.currentTarget.dataset.index
      const checkedMap = { ...this.data.checkedMap }
      checkedMap[index] = !checkedMap[index]
      this.setData({ checkedMap })
      this.triggerEvent('change', { checkedMap })
    },

    // 重置全部勾选
    reset() {
      this.setData({ checkedMap: {} })
    }
  }
})
