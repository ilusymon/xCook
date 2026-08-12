const app = getApp()
const cloud = require('../../../utils/cloud')

const BOTTOM_NAVIGATION = [
  { key: 'menu', label: '菜单', icon: '/images/menu/17_nav_menu.png', width: 53, height: 50 },
  { key: 'wishlist', label: '愿望单', icon: '/images/menu/20_nav_wishlist.png', width: 52, height: 49 },
  { key: 'record', label: '记录', icon: '/images/menu/18_nav_record.png', width: 51, height: 50 },
  { key: 'profile', label: '我的', icon: '/images/menu/19_nav_profile.png', width: 48, height: 41 }
]

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
    coverImage: record.coverImage || (daily ? '/images/menu/10_dish_rice.png' : '/images/menu/09_dish_pasta.png'),
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
    statusBarHeight: 20,
    navigationHeight: 64,
    navigationContentTop: 26,
    navigationContentHeight: 32,
    ginghamTiles: Array.from({ length: 56 }, (_, index) => index),
    bottomNavigation: BOTTOM_NAVIGATION,
    filters: FILTERS,
    currentFilter: '',
    groups: [],
    loading: true,
    showForm: false,
    foodTags: ['早餐', '午餐', '晚餐', '加餐'],
    draft: { title: '', description: '', tag: '早餐' }
  },

  onLoad() {
    this.setupNavigation()
  },

  onShow() {
    this._visible = true
    wx.hideTabBar({ animation: false })
    this.loadRecords().finally(() => {
      if (this._visible) this.startWatch()
    })
  },

  onHide() {
    this._visible = false
    this.stopWatch()
  },

  onUnload() {
    this._visible = false
    this.stopWatch()
  },

  setupNavigation() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const statusBarHeight = windowInfo.statusBarHeight || 20
      const navigationContentTop = menuButton ? menuButton.top : statusBarHeight + 6
      const navigationContentHeight = menuButton ? menuButton.height : 32
      this.setData({
        statusBarHeight,
        navigationContentTop,
        navigationContentHeight,
        navigationHeight: navigationContentTop + navigationContentHeight + 6
      })
    } catch (e) {}
  },

  loadRecords() {
    this.setData({ loading: true })
    return cloud.getFoodRecords(this.data.currentFilter)
      .then(res => {
        this.setRecords((res && res.records) || [])
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '记录加载失败', icon: 'none' })
      })
  },

  startWatch() {
    this.stopWatch()
    this._watcher = cloud.watchFoodRecords(this.data.currentFilter, records => this.setRecords(records))
  },

  stopWatch() {
    if (this._watcher) this._watcher.close()
    this._watcher = null
  },

  setRecords(items) {
    const records = (items || []).map(decorate)
    this.setData({ groups: groupRecords(records), loading: false })
  },

  changeFilter(e) {
    this.setData({ currentFilter: e.currentTarget.dataset.value, groups: [], loading: true }, () => this.startWatch())
  },

  openForm() {
    this.setData({ showForm: true, draft: { title: '', description: '', tag: '早餐' } })
  },

  closeForm() {
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
    const title = this.data.draft.title.trim()
    if (!title) {
      wx.showToast({ title: '写下这顿吃了什么吧', icon: 'none' })
      return
    }
    wx.showLoading({ title: '记录中...' })
    cloud.createFoodRecord({ ...this.data.draft, title })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已经记下来啦', icon: 'success' })
        this.setData({ showForm: false, currentFilter: 'daily', groups: [], loading: true }, () => this.startWatch())
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '记录失败', icon: 'none' })
      })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onBottomNavTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'record') return
    if (key === 'menu') wx.switchTab({ url: '/pages/order/menu/index' })
    if (key === 'wishlist') {
      app.globalData.wishlistRole = 'orderer'
      wx.switchTab({ url: '/pages/order/wishlist/index' })
    }
    if (key === 'profile') wx.switchTab({ url: '/pages/profile/index' })
  }
})
