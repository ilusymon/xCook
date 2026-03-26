const app = getApp()
const cloud = require('../../../utils/cloud')
const upload = require('../../../utils/upload')

Page({
  data: {
    isEdit: false,
    dish: {
      name: '',
      description: '',
      coverImage: '',
      price: '',
      calories: '',
      preparationTime: '',
      difficulty: 1,
      categoryId: '',
      isAvailable: true,
      optionGroups: [],
      materials: [],
      steps: [],
      videoUrl: ''
    },
    categories: [],
    categoryNames: [],
    categoryIndex: 0
  },

  onLoad(options) {
    this.loadCategories()
    if (options.id) {
      this.setData({ isEdit: true })
      this.loadDish(options.id)
    }
  },

  loadCategories() {
    cloud.getMenu('chef').then(res => {
      if (res && res.categories) {
        const categoryNames = res.categories.map(c => c.name)
        this.setData({
          categories: res.categories,
          categoryNames
        })
      }
    })
  },

  loadDish(dishId) {
    wx.showLoading({ title: '加载中...' })
    cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        // 找到分类索引
        const catIdx = this.data.categories.findIndex(c => c._id === res.categoryId)
        this.setData({
          dish: res,
          categoryIndex: catIdx > -1 ? catIdx : 0
        })
      }
    })
  },

  // 基本输入
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`dish.${field}`]: e.detail.value })
  },

  onInputNumber(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`dish.${field}`]: Number(e.detail.value) || 0 })
  },

  setDifficulty(e) {
    this.setData({ 'dish.difficulty': e.currentTarget.dataset.value })
  },

  onCategoryChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      categoryIndex: idx,
      'dish.categoryId': this.data.categories[idx]._id
    })
  },

  // 封面图
  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.setData({ 'dish.coverImage': filePath })
      }
    })
  },

  // === 选项组管理（树形） ===
  addOptionGroup() {
    const groups = this.data.dish.optionGroups
    groups.push({
      groupName: '',
      type: 'single',
      required: false,
      expanded: true,
      options: [{ label: '', value: '', extraPrice: 0 }]
    })
    this.setData({ 'dish.optionGroups': groups })
  },

  toggleGroupExpand(e) {
    const idx = e.currentTarget.dataset.idx
    const current = this.data.dish.optionGroups[idx].expanded
    this.setData({ [`dish.optionGroups[${idx}].expanded`]: current === false })
  },

  removeOptionGroup(e) {
    const groups = this.data.dish.optionGroups
    groups.splice(e.currentTarget.dataset.idx, 1)
    this.setData({ 'dish.optionGroups': groups })
  },

  onOptionGroupInput(e) {
    const { idx, field } = e.currentTarget.dataset
    this.setData({ [`dish.optionGroups[${idx}].${field}`]: e.detail.value })
  },

  toggleOptionType(e) {
    const idx = e.currentTarget.dataset.idx
    const current = this.data.dish.optionGroups[idx].type
    this.setData({ [`dish.optionGroups[${idx}].type`]: current === 'single' ? 'multi' : 'single' })
  },

  toggleRequired(e) {
    const idx = e.currentTarget.dataset.idx
    const current = this.data.dish.optionGroups[idx].required
    this.setData({ [`dish.optionGroups[${idx}].required`]: !current })
  },

  addOption(e) {
    const idx = e.currentTarget.dataset.idx
    const options = this.data.dish.optionGroups[idx].options
    options.push({ label: '', value: '', extraPrice: 0 })
    this.setData({ [`dish.optionGroups[${idx}].options`]: options })
  },

  removeOption(e) {
    const { gidx, oidx } = e.currentTarget.dataset
    const options = this.data.dish.optionGroups[gidx].options
    options.splice(oidx, 1)
    this.setData({ [`dish.optionGroups[${gidx}].options`]: options })
  },

  onOptionInput(e) {
    const { gidx, oidx, field } = e.currentTarget.dataset
    this.setData({ [`dish.optionGroups[${gidx}].options[${oidx}].${field}`]: e.detail.value })
    // 自动设置 value 为 label
    if (field === 'label') {
      this.setData({ [`dish.optionGroups[${gidx}].options[${oidx}].value`]: e.detail.value })
    }
  },

  onOptionPriceInput(e) {
    const { gidx, oidx } = e.currentTarget.dataset
    this.setData({ [`dish.optionGroups[${gidx}].options[${oidx}].extraPrice`]: Number(e.detail.value) || 0 })
  },

  // === 材料管理 ===
  addMaterial() {
    const materials = this.data.dish.materials
    materials.push({ name: '', amount: '', note: '' })
    this.setData({ 'dish.materials': materials })
  },

  removeMaterial(e) {
    const materials = this.data.dish.materials
    materials.splice(e.currentTarget.dataset.idx, 1)
    this.setData({ 'dish.materials': materials })
  },

  onMaterialInput(e) {
    const { idx, field } = e.currentTarget.dataset
    this.setData({ [`dish.materials[${idx}].${field}`]: e.detail.value })
  },

  // === 步骤管理 ===
  addStep() {
    const steps = this.data.dish.steps
    steps.push({ stepNumber: steps.length + 1, description: '', image: '', duration: '' })
    this.setData({ 'dish.steps': steps })
  },

  removeStep(e) {
    const steps = this.data.dish.steps
    steps.splice(e.currentTarget.dataset.idx, 1)
    // 重新编号
    steps.forEach((s, i) => { s.stepNumber = i + 1 })
    this.setData({ 'dish.steps': steps })
  },

  onStepInput(e) {
    const { idx, field } = e.currentTarget.dataset
    let val = e.detail.value
    if (field === 'duration') val = Number(val) || 0
    this.setData({ [`dish.steps[${idx}].${field}`]: val })
  },

  chooseStepImage(e) {
    const idx = e.currentTarget.dataset.idx
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        this.setData({ [`dish.steps[${idx}].image`]: res.tempFiles[0].tempFilePath })
      }
    })
  },

  moveStepUp(e) {
    const idx = e.currentTarget.dataset.idx
    if (idx <= 0) return
    const steps = this.data.dish.steps
    ;[steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]]
    steps.forEach((s, i) => { s.stepNumber = i + 1 })
    this.setData({ 'dish.steps': steps })
  },

  moveStepDown(e) {
    const idx = e.currentTarget.dataset.idx
    const steps = this.data.dish.steps
    if (idx >= steps.length - 1) return
    ;[steps[idx], steps[idx + 1]] = [steps[idx + 1], steps[idx]]
    steps.forEach((s, i) => { s.stepNumber = i + 1 })
    this.setData({ 'dish.steps': steps })
  },

  // === 保存 ===
  async saveDish() {
    const dish = { ...this.data.dish }

    // 清理选项组中的 UI 临时字段
    if (dish.optionGroups) {
      dish.optionGroups = dish.optionGroups.map(group => {
        const { expanded, ...rest } = group
        return rest
      })
    }

    // 验证
    if (!dish.name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' }); return
    }
    if (!dish.price && dish.price !== 0) {
      wx.showToast({ title: '请设置价格', icon: 'none' }); return
    }
    if (!dish.categoryId && this.data.categories.length > 0) {
      dish.categoryId = this.data.categories[this.data.categoryIndex]._id
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 收集需要上传的本地图片
      const uploadTasks = []

      // 封面图（如果是本地文件）
      if (dish.coverImage && !upload.isRemoteUrl(dish.coverImage)) {
        uploadTasks.push({ type: 'cover', filePath: dish.coverImage })
      }

      // 步骤图片
      for (let i = 0; i < dish.steps.length; i++) {
        const step = dish.steps[i]
        if (step.image && !upload.isRemoteUrl(step.image)) {
          uploadTasks.push({ type: 'step', index: i, filePath: step.image })
        }
      }

      // 逐个压缩上传并更新进度
      if (uploadTasks.length > 0) {
        for (let t = 0; t < uploadTasks.length; t++) {
          wx.showLoading({ title: `上传图片 ${t + 1}/${uploadTasks.length}...` })
          const task = uploadTasks[t]
          const imageUrl = await upload.uploadImage(task.filePath)
          if (task.type === 'cover') {
            dish.coverImage = imageUrl
          } else {
            dish.steps[task.index].image = imageUrl
          }
        }
      }

      wx.showLoading({ title: '保存中...' })

      // 保存到云端
      const res = await cloud.saveDish(dish)
      wx.hideLoading()

      if (res && res.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('保存菜品失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
