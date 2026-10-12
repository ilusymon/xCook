Component({
  properties: {
    optionGroups: {
      type: Array,
      value: []
    }
  },

  data: {
    selections: {},
    groups: []
  },

  observers: {
    optionGroups() {
      this.setData({ selections: {} })
      this.updateGroups()
    }
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
      this.updateGroups()
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
      this.updateGroups()
    },

    updateGroups() {
      const selections = this.data.selections
      this.setData({ groups: this.data.optionGroups.map(group => ({
        ...group,
        options: (group.options || []).map(option => ({
          ...option,
          selected: (selections[group.groupName] || []).includes(option.value)
        }))
      })) })
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
      this.updateGroups()
    }
  }
})
