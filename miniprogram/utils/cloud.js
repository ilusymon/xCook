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
 * 下单
 */
function placeOrder(items, note) {
  return api.request({
    url: '/api/orders',
    method: 'POST',
    data: { items, note }
  })
}

/**
 * 获取订单列表
 */
function getOrders(role, status, page = 1, pageSize = 10) {
  const data = { page, pageSize }
  if (role) data.role = role
  if (status !== undefined) data.status = status
  return api.request({
    url: '/api/orders',
    method: 'GET',
    data
  }).then(media.normalizeOrdersResponse)
}

function getOrderDetail(orderId) {
  return api.request({
    url: `/api/orders/${orderId}`,
    method: 'GET'
  }).then(media.normalizeOrderDetailResponse)
}

/**
 * 更新订单状态
 */
function updateOrderStatus(orderId, newStatus) {
  return api.request({
    url: `/api/orders/${orderId}/status`,
    method: 'PATCH',
    data: { status: newStatus }
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
 * 调整星星币
 */
function adjustStarCoins(targetUserId, amount, reason) {
  return api.request({
    url: `/api/users/${targetUserId}/star-coins/adjust`,
    method: 'POST',
    data: { amount, reason }
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
  getMenu,
  getDishDetail,
  saveDish,
  deleteDish,
  placeOrder,
  getOrders,
  getOrderDetail,
  updateOrderStatus,
  saveCategory,
  deleteCategory,
  adjustStarCoins,
  watchOrder,
  watchNewOrders,
  uploadImage
}
