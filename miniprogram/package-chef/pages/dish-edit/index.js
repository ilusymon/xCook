const cloud = require('../../../utils/cloud')
const upload = require('../../../utils/upload')

Page({
  data: {
    isEdit: false,
    dish: {
      name: '',
      description: '',
      coverImage: '',
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
    categoryIndex: 0,
    loading: true,
    error: '',
    saving: false
  },

  onLoad(options) {
    this._dishId = options.id
    if (options.id) {
      this.setData({ isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑菜品' })
    } else wx.setNavigationBarTitle({ title: '新增菜品' })
    this.loadCategories().then(() => {
      if (options.id && !this.data.error) return this.loadDish(options.id)
    })
  },

  onShow() {
    if (this._loaded) this.loadCategories()
  },

  loadCategories() {
    this.setData({ loading: true, error: '' })
    return cloud.getMenu('chef').then(res => {
      if (res && res.categories) {
        const categoryNames = res.categories.map(c => c.name)
        const index = res.categories.findIndex(c => String(c._id) === String(this.data.dish.categoryId))
        this.setData({
          categories: res.categories,
          categoryNames,
          categoryIndex: index >= 0 ? index : 0,
          loading: false
        })
        this._loaded = true
      }
    }).catch(err => this.setData({ loading: false, error: err.message || '分类加载失败' }))
  },

  loadDish(dishId) {
    this.setData({ loading: true, error: '' })
    wx.showLoading({ title: '加载中...' })
    return cloud.getDishDetail(dishId).then(res => {
      wx.hideLoading()
      if (res) {
        // 找到分类索引
        const catIdx = this.data.categories.findIndex(c => String(c._id) === String(res.categoryId))
        this.setData({
          dish: res,
          loading: false,
          categoryIndex: catIdx > -1 ? catIdx : 0
        })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false, error: err.message || '菜品加载失败' })
    })
  },

  retryLoad() {
    this.loadCategories().then(() => {
      if (this._dishId && !this.data.error) return this.loadDish(this._dishId)
    })
  },

  goCategories() {
    wx.navigateTo({ url: '/package-chef/pages/category-manage/index' })
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
      options: [{ label: '', value: '' }]
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
    options.push({ label: '', value: '' })
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
    if (this.data.saving || this.data.loading || this.data.error) return
    const dish = JSON.parse(JSON.stringify(this.data.dish))
    dish.name = dish.name.trim()

    // 清理选项组中的 UI 临时字段
    if (dish.optionGroups) {
      dish.optionGroups = dish.optionGroups.map(group => {
        const { expanded, ...rest } = group
        return {
          ...rest,
          options: (rest.options || []).map(option => ({ label: option.label, value: option.value }))
        }
      })
    }
    delete dish.price

    // 验证
    if (!dish.name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' }); return
    }
    if (!this.data.categories.length) {
      wx.showToast({ title: '请先添加菜品分类', icon: 'none' }); return
    }
    if (!this.data.categories.some(category => String(category._id) === String(dish.categoryId))) {
      dish.categoryId = this.data.categories[this.data.categoryIndex]._id
    }

    for (const group of dish.optionGroups) {
      if (!group.groupName.trim() || !group.options.length || group.options.some(option => !option.label.trim())) {
        wx.showToast({ title: '请补全口味组和选项', icon: 'none' }); return
      }
    }
    if (dish.materials.some(material => !material.name.trim()) || dish.steps.some(step => !step.description.trim())) {
      wx.showToast({ title: '请补全食材和制作步骤', icon: 'none' }); return
    }
    dish.calories = Number(dish.calories || 0)
    dish.preparationTime = Number(dish.preparationTime || 0)
    dish.steps = dish.steps.map((step, index) => ({ ...step, stepNumber: index + 1, duration: Number(step.duration || 0) }))

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })

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
        this._saved = true
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('保存菜品失败', err)
      const errMsg = err.message || '保存失败'
      wx.showModal({
        title: '保存失败',
        content: errMsg,
        showCancel: false
      })
    } finally {
      if (!this._saved) this.setData({ saving: false })
    }
  }
})
