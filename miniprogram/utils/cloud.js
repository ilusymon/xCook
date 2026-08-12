/**
 * 自建 Go 服务 API 封装
 */

const api = require('./api')
const media = require('./media')

const db = null
const _ = null
const collections = {}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return api.request({
    url: '/api/users/me',
    method: 'GET'
  })
}

/**
 * 获取菜单（分类 + 菜品）
 * @param {string} role - 'chef' 时返回全部菜品（含下架），默认只返回上架菜品
 */
function getMenu(role) {
  return api.request({
    url: '/api/menu',
    method: 'GET',
    data: role ? { role } : undefined
  }).then(media.normalizeMenuResponse)
}

/**
 * 获取启用中的分类列表
 */
function getCategories() {
  return api.request({
    url: '/api/categories',
    method: 'GET'
  }).then(res => (res && res.categories) || [])
}

/**
 * 获取菜品详情
 */
function getDishDetail(dishId) {
  return api.request({
    url: `/api/dishes/${dishId}`,
    method: 'GET'
  }).then(media.normalizeDish)
}

/**
 * 保存菜品（新建或更新）
 */
function saveDish(dish) {
  const payload = media.denormalizeDish(dish)
  const method = dish && dish._id ? 'PUT' : 'POST'
  const url = dish && dish._id ? `/api/dishes/${dish._id}` : '/api/dishes'
  return api.request({
    url,
    method,
    data: payload
  })
}

/**
 * 删除菜品（软删除）
 */
function deleteDish(dishId) {
  return api.request({
    url: `/api/dishes/${dishId}`,
    method: 'DELETE'
  })
}

/**
 * 提交愿望单（完整保留原订单的菜品、数量、选项和备注能力）
 */
function createWishlist(items, note) {
  const normalizedItems = (items || []).map(item => ({
    ...item,
    dishId: Number(item.dishId),
    quantity: Number(item.quantity)
  }))
  return api.request({
    url: '/api/wishlists',
    method: 'POST',
    data: { items: normalizedItems, note }
  })
}

function getWishlist(role, status, page = 1, pageSize = 10) {
  const data = { page, pageSize }
  if (role) data.role = role
  if (status !== undefined) data.status = status
  return api.request({
    url: '/api/wishlists',
    method: 'GET',
    data
  }).then(media.normalizeWishlistResponse)
}

function getWishlistDetail(wishlistId, role) {
  return api.request({
    url: `/api/wishlists/${wishlistId}`,
    method: 'GET',
    data: role ? { role } : undefined
  }).then(media.normalizeWishlistResponse)
}

function updateWishlistStatus(wishlistId, newStatus) {
  return api.request({
    url: `/api/wishlists/${wishlistId}/status`,
    method: 'PATCH',
    data: { status: newStatus }
  })
}

function updateWishlistDishProgress(wishlistId, itemIndex, action) {
  return api.request({
    url: `/api/wishlists/${wishlistId}/items/${itemIndex}`,
    method: 'PATCH',
    data: { action }
  })
}

// Compatibility aliases for pages that have not yet been renamed on disk.
function placeOrder(items, note) {
  return createWishlist(items, note)
}

function getOrders(role, status, page = 1, pageSize = 10) {
  return getWishlist(role, status, page, pageSize).then(res => ({
    ...res,
    orders: res && res.wishlists ? res.wishlists : []
  }))
}

function getOrderDetail(orderId, role) {
  return getWishlistDetail(orderId, role).then(res => ({
    ...res,
    order: res && res.wishlist ? res.wishlist : null
  }))
}

function updateOrderStatus(orderId, newStatus) {
  return updateWishlistStatus(orderId, newStatus)
}

function getFoodRecords(type) {
  return api.request({
    url: '/api/food-records',
    method: 'GET',
    data: type ? { type } : undefined
  }).then(media.normalizeFoodRecordsResponse)
}

function createFoodRecord(record) {
  return api.request({
    url: '/api/food-records',
    method: 'POST',
    data: record
  })
}

/**
 * 保存分类（新建或更新）
 */
function saveCategory(category) {
  const method = category && category._id ? 'PATCH' : 'POST'
  const url = category && category._id ? `/api/categories/${category._id}` : '/api/categories'
  return api.request({
    url,
    method,
    data: category
  })
}

/**
 * 删除分类
 */
function deleteCategory(categoryId) {
  return api.request({
    url: `/api/categories/${categoryId}`,
    method: 'DELETE'
  })
}

/**
 * 监听订单变化（实时）
 */
function watchOrder(orderId, onChange) {
  return createPollWatcher(
    () => getOrderDetail(orderId),
    (res) => res && res.order ? res.order : null,
    onChange,
    '监听订单失败'
  )
}

/**
 * 监听新订单（厨师端）
 */
function watchNewOrders(onChange) {
  return createPollWatcher(
    () => getOrders('chef', 'placed', 1, 50),
    (res) => res && res.orders ? res.orders : [],
    onChange,
    '监听新订单失败'
  )
}

function watchWishlistDetail(wishlistId, role, onChange) {
  return createPollWatcher(
    () => getWishlistDetail(wishlistId, role),
    (res) => res && res.wishlist ? res.wishlist : null,
    onChange,
    '监听愿望进度失败'
  )
}

function watchWishlist(role, onChange) {
  return createPollWatcher(
    () => getWishlist(role, '', 1, 50),
    (res) => res && res.wishlists ? res.wishlists : [],
    onChange,
    '监听愿望单失败'
  )
}

function watchFoodRecords(type, onChange) {
  return createPollWatcher(
    () => getFoodRecords(type),
    (res) => res && res.records ? res.records : [],
    onChange,
    '监听饮食记录失败'
  )
}

/**
 * 上传图片到后端
 * @param {string} filePath - 本地图片路径
 * @param {string} _cloudPath - 已废弃参数，保留兼容
 * @param {Object} options - 上传选项（quality, compress）
 */
function uploadImage(filePath, _cloudPath, options) {
  const upload = require('./upload')
  return upload.uploadImage(filePath, options)
}

function createPollWatcher(fetcher, formatter, onChange, errorLabel) {
  let closed = false
  let timer = null
  let lastValue = ''

  const poll = () => {
    fetcher()
      .then((res) => {
        if (closed) return
        const value = formatter(res)
        const serialized = JSON.stringify(value || null)
        if (serialized !== lastValue) {
          lastValue = serialized
          onChange(value)
        }
      })
      .catch((err) => {
        console.error(errorLabel, err)
      })
      .finally(() => {
        if (!closed) {
          timer = setTimeout(poll, api.POLL_INTERVAL)
        }
      })
  }

  poll()

  return {
    close() {
      closed = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }
}

module.exports = {
  db,
  _,
  collections,
  getUserInfo,
  getCategories,
  getMenu,
  getDishDetail,
  saveDish,
  deleteDish,
  createWishlist,
  placeOrder,
  getOrders,
  getOrderDetail,
  updateOrderStatus,
  getWishlist,
  getWishlistDetail,
  updateWishlistStatus,
  updateWishlistDishProgress,
  watchWishlist,
  watchWishlistDetail,
  getFoodRecords,
  createFoodRecord,
  watchFoodRecords,
  saveCategory,
  deleteCategory,
  watchOrder,
  watchNewOrders,
  uploadImage
}
