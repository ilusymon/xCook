const cloud = require('../../../utils/cloud')

const ICON_LIST = [
  { key: 'meat', emoji: '🥩', label: '荤菜' },
  { key: 'vegetable', emoji: '🥬', label: '素菜' },
  { key: 'soup', emoji: '🍲', label: '汤品' },
  { key: 'staple', emoji: '🍚', label: '主食' },
  { key: 'dessert', emoji: '🍰', label: '甜品' },
  { key: 'drink', emoji: '🧃', label: '饮品' },
  { key: 'seafood', emoji: '🦐', label: '海鲜' },
  { key: 'snack', emoji: '🍿', label: '小食' },
  { key: 'fruit', emoji: '🍎', label: '水果' },
  { key: 'default', emoji: '🍽️', label: '其他' }
]

function getEmoji(iconKey) {
  const found = ICON_LIST.find(i => i.key === iconKey)
  return found ? found.emoji : '🍽️'
}

Page({
  data: {
    categories: [],
    iconList: ICON_LIST,
    editingId: '',
    editName: '',
    editIcon: '',
    showIconPicker: false,
    loading: false,
    error: '',
    saving: false
  },

  onShow() {
    this.loadCategories()
  },

  loadCategories() {
    this.setData({ loading: true, error: '' })
    return cloud.getMenu('chef').then(res => {
      if (res && res.categories) {
        const categories = res.categories.map(c => ({
          ...c,
          emoji: getEmoji(c.icon)
        }))
        this.setData({ categories, loading: false })
      }
    }).catch(err => this.setData({ loading: false, error: err.message || '分类加载失败' }))
  },

  // 添加分类
  addCategory() {
    if (this.data.saving) return
    this.setData({ saving: true })
    cloud.saveCategory({ name: '新分类', icon: 'default' }).then(res => {
      if (res && res.success) {
        return this.loadCategories().then(() => {
          this.setData({ editingId: res.id, editName: '新分类', editIcon: 'default' })
        })
      }
    }).catch(err => wx.showToast({ title: err.message || '添加失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }))
  },

  // 进入编辑
  startEdit(e) {
    const { id, name, icon } = e.currentTarget.dataset
    this.setData({ editingId: id, editName: name, editIcon: icon || 'default' })
  },

  // 取消编辑
  cancelEdit() {
    this.setData({ editingId: '', editName: '', editIcon: '', showIconPicker: false })
  },

  // 名称输入
  onNameInput(e) {
    this.setData({ editName: e.detail.value })
  },

  // 显示图标选择
  toggleIconPicker() {
    this.setData({ showIconPicker: !this.data.showIconPicker })
  },

  // 选择图标
  pickIcon(e) {
    const icon = e.currentTarget.dataset.key
    this.setData({ editIcon: icon, showIconPicker: false })
  },

  // 保存编辑
  saveEdit() {
    if (this.data.saving) return
    const { editingId, editName, editIcon } = this.data
    if (!editName.trim()) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    cloud.saveCategory({ _id: editingId, name: editName.trim(), icon: editIcon }).then(res => {
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' })
        this.cancelEdit()
        this.loadCategories()
      }
    }).catch(err => wx.showToast({ title: err.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }))
  },

  // 切换启用状态
  toggleActive(e) {
    if (this.data.saving) return
    const { id } = e.currentTarget.dataset
    this.setData({ saving: true })
    cloud.saveCategory({ _id: id, isActive: e.detail.value }).then(res => {
      if (res && res.success) {
        this.loadCategories()
      }
    }).catch(err => {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
      this.loadCategories()
    }).finally(() => this.setData({ saving: false }))
  },

  // 上移
  moveUp(e) {
    this.swapSort(e.currentTarget.dataset.index, -1)
  },

  // 下移
  moveDown(e) {
    this.swapSort(e.currentTarget.dataset.index, 1)
  },

  swapSort(index, direction) {
    if (this.data.saving) return
    index = Number(index)
    const { categories } = this.data
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= categories.length) return

    const a = categories[index]
    const b = categories[targetIndex]

    // 交换 sortOrder
    this.setData({ saving: true })
    cloud.saveCategory({ _id: a._id, swapWith: b._id }).then(() => {
      this.loadCategories()
    }).catch(err => {
      wx.showToast({ title: err.message || '排序失败，请重试', icon: 'none' })
      this.loadCategories()
    }).finally(() => this.setData({ saving: false }))
  },

  // 删除分类
  deleteCategory(e) {
    if (this.data.saving) return
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除分类',
      content: `确认删除「${name}」？如果分类下有菜品将无法删除。`,
      confirmColor: '#FF6B81',
      success: (res) => {
        if (res.confirm) {
          this.setData({ saving: true })
          cloud.deleteCategory(id).then(res => {
            if (res && res.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadCategories()
            } else {
              wx.showToast({ title: res.message || '删除失败', icon: 'none' })
            }
          }).catch(err => wx.showToast({ title: err.message || '删除失败', icon: 'none' }))
            .finally(() => this.setData({ saving: false }))
        }
      }
    })
  }
})
