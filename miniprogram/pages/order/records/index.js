const cloud = require('../../../utils/cloud')

const FILTERS = [
  { label: '全部', value: '' },
  { label: '愿望', value: 'order' },
  { label: '日常', value: 'daily' }
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function dayKey(date) {
  const value = new Date(date)
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function groupTitle(key) {
  const date = new Date(`${key}T00:00:00`)
  const today = new Date()
  const todayKey = dayKey(today)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const prefix = key === todayKey ? '今天 · ' : key === dayKey(yesterday) ? '昨天 · ' : ''
  return `${prefix}${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

function decorate(record, index) {
  const occurredAt = new Date(record.occurredAt)
  const daily = record.type === 'daily'
  const description = daily
    ? [record.tag, record.description].filter(Boolean).join(' · ')
    : record.description || `${record.calories || 0} kcal`
  return {
    ...record,
    coverImage: record.coverImage || '',
    typeLabel: daily ? '日常' : '愿望',
    typeClass: daily ? 'daily' : 'order',
    statusText: daily ? '已记录' : '已完成',
    description,
    timeText: `${pad(occurredAt.getHours())}:${pad(occurredAt.getMinutes())}`,
    groupKey: dayKey(record.occurredAt),
    key: record._id || `${record.type}-${index}`
  }
}

function groupRecords(records) {
  const groups = []
  records.forEach(record => {
    let group = groups[groups.length - 1]
    if (!group || group.key !== record.groupKey) {
      group = { key: record.groupKey, title: groupTitle(record.groupKey), records: [] }
      groups.push(group)
    }
    group.records.push(record)
  })
  return groups
}

Page({
  data: {
    filters: FILTERS,
    currentFilter: '',
    groups: [],
    loading: true,
    error: '',
    saving: false,
    showForm: false,
    foodTags: ['早餐', '午餐', '晚餐', '加餐'],
    draft: { title: '', description: '', tag: '早餐' }
  },

  onShow() {
    this._visible = true
    wx.hideTabBar({ animation: false })
    this.startWatch()
  },

  onHide() {
    this._visible = false
    this.stopWatch()
  },

  onUnload() {
    this._visible = false
    this.stopWatch()
  },

  loadRecords() {
    this.setData({ loading: true, error: '' })
    this.startWatch()
  },

  startWatch() {
    this.stopWatch()
    if (this._visible === false) return
    this._watcher = cloud.watchFoodRecords(this.data.currentFilter, records => this.setRecords(records),
      err => this.setData({ loading: false, error: err.message || '记录加载失败' }))
  },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  setRecords(items) {
    const records = (items || []).map(decorate)
    this.setData({ groups: groupRecords(records), loading: false, error: '' })
  },

  changeFilter(e) {
    this.setData({ currentFilter: e.currentTarget.dataset.value, groups: [], loading: true, error: '' }, () => this.startWatch())
  },

  openForm() {
    this.setData({ showForm: true, draft: { title: '', description: '', tag: '早餐' } })
  },

  closeForm() {
    if (this.data.saving) return
    this.setData({ showForm: false })
  },

  stopPropagation() {},

  updateDraft(e) {
    this.setData({ [`draft.${e.currentTarget.dataset.field}`]: e.detail.value })
  },

  chooseTag(e) {
    this.setData({ 'draft.tag': e.currentTarget.dataset.tag })
  },

  saveRecord() {
    if (this.data.saving) return
    const title = this.data.draft.title.trim()
    if (!title) {
      wx.showToast({ title: '写下这顿吃了什么吧', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    wx.showLoading({ title: '记录中...', mask: true })
    cloud.createFoodRecord({ ...this.data.draft, title })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已经记下来啦', icon: 'success' })
        this.setData({ showForm: false, currentFilter: 'daily', groups: [], loading: true }, () => this.startWatch())
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '记录失败', icon: 'none' })
      })
      .finally(() => this.setData({ saving: false }))
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

})
