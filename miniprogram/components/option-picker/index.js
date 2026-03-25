Component({
  properties: {
    optionGroups: {
      type: Array,
      value: []
    }
  },

  data: {
    selections: {} // { groupName: [selectedValues] }
  },

  methods: {
    onSingleSelect(e) {
      const { group, value } = e.currentTarget.dataset
      const selections = { ...this.data.selections }
      // 单选：切换或取消
      if (selections[group] && selections[group][0] === value) {
        // 检查是否必选
        const groupConfig = this.data.optionGroups.find(g => g.groupName === group)
        if (groupConfig && groupConfig.required) return // 必选不可取消
        delete selections[group]
      } else {
        selections[group] = [value]
      }
      this.setData({ selections })
      this.emitChange()
    },

    onMultiSelect(e) {
      const { group, value } = e.currentTarget.dataset
      const selections = { ...this.data.selections }
      if (!selections[group]) {
        selections[group] = []
      }
      const idx = selections[group].indexOf(value)
      if (idx > -1) {
        selections[group].splice(idx, 1)
        if (selections[group].length === 0) {
          delete selections[group]
        }
      } else {
        selections[group] = [...selections[group], value]
      }
      this.setData({ selections })
      this.emitChange()
    },

    emitChange() {
      const selections = this.data.selections
      // 计算加价
      let extraPrice = 0
      this.data.optionGroups.forEach(group => {
        const selected = selections[group.groupName] || []
        group.options.forEach(opt => {
          if (selected.includes(opt.value)) {
            extraPrice += opt.extraPrice || 0
          }
        })
      })
      this.triggerEvent('change', { selections, extraPrice })
    },

    // 验证必选项是否已选
    validate() {
      const selections = this.data.selections
      for (const group of this.data.optionGroups) {
        if (group.required) {
          if (!selections[group.groupName] || selections[group.groupName].length === 0) {
            return { valid: false, message: `请选择${group.groupName}` }
          }
        }
      }
      return { valid: true }
    },

    // 获取选择结果
    getSelections() {
      return this.data.selections
    },

    // 重置选择
    reset() {
      this.setData({ selections: {} })
    }
  }
})
