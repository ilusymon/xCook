const app = getApp()
const cloud = require('../../utils/cloud')

function countDishes(menu) {
  return Object.values((menu && menu.dishes) || {}).reduce((total, dishes) => total + dishes.length, 0)
}

function countRecordDays(records) {
  return new Set((records || []).map(record => String(record.occurredAt || '').slice(0, 10)).filter(Boolean)).size
}

function roleLabel(role) {
  if (role === 'chef') return '我是大厨'
  if (role === 'both') return '双重身份'
  return '我是吃货'
}

Page({
  data: {
    user: {
      nickName: '厨房伙伴',
      avatarUrl: '/images/cartoon/profile.svg',
      roleLabel: '我是吃货'
    },
    togetherDays: 1,
    orderCount: 0,
    dishCount: 0,
    recordDays: 0,
    error: '',
    loading: false,
    showForm: false,
    nickName: '',
    saving: false
  },

  onShow() {
    wx.hideTabBar({ animation: false })
    this.loadProfile()
  },

  loadProfile() {
    this.setData({ loading: true, error: '' })
    return Promise.all([
      cloud.getUserInfo(),
      cloud.getWishlist('', '', 1, 1),
      cloud.getMenu('chef'),
      cloud.getFoodRecords()
    ]).then(([user, wishlists, menu, records]) => {
      user = user || {}
      app.globalData.userInfo = user
      app.globalData.role = user.role
      app.globalData.openid = user.openid
      const createdAt = new Date(user.createdAt)
      const togetherDays = Number.isNaN(createdAt.getTime())
        ? 1
        : Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86400000) + 1)
      this.setData({
        user: {
          nickName: user.nickName || '厨房伙伴',
          avatarUrl: user.avatarUrl || '/images/cartoon/profile.svg',
          roleLabel: roleLabel(user.role)
        },
        togetherDays,
        loading: false,
        orderCount: Number((wishlists && wishlists.total) || 0),
        dishCount: countDishes(menu),
        recordDays: countRecordDays(records && records.records)
      })
    }).catch(err => this.setData({ loading: false, error: err.message || '个人信息加载失败' }))
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  goSearch() {
    app.globalData.searchMenu = true
    wx.switchTab({ url: '/pages/order/menu/index' })
  },

  showProfileInfo() {
    this.setData({ showForm: true, nickName: (app.globalData.userInfo || {}).nickName || '' })
  },

  closeForm() {
    if (!this.data.saving) this.setData({ showForm: false })
  },

  stopPropagation() {},

  onNameInput(e) { this.setData({ nickName: e.detail.value }) },

  saveProfile() {
    if (this.data.saving) return
    const nickName = this.data.nickName.trim()
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    cloud.updateUserInfo(nickName).then(user => {
      app.globalData.userInfo = user
      this.setData({ 'user.nickName': user.nickName, showForm: false })
      wx.showToast({ title: '昵称已保存', icon: 'success' })
    }).catch(err => wx.showToast({ title: err.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }))
  },

  goDishManage() {
    wx.navigateTo({ url: '/package-chef/pages/dish-manage/index' })
  },

  goCategoryManage() {
    wx.navigateTo({ url: '/package-chef/pages/category-manage/index' })
  },

  goChef() {
    wx.navigateTo({ url: '/pages/chef/dashboard/index' })
  },

})
