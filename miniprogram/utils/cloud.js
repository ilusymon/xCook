/**
 * 自建 Go 服务 API 封装
 */

const api = require('./api')

const db = null
const _ = null
const collections = {}

function callFunction(name, data = {}) {
  return api.request({
    url: `/api/functions/${name}`,
    method: 'POST',
    data
  })
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return callFunction('getUserInfo')
}

/**
 * 获取菜单（分类 + 菜品）
 * @param {string} role - 'chef' 时返回全部菜品（含下架），默认只返回上架菜品
 */
function getMenu(role) {
  return callFunction('getMenu', { role })
}

/**
 * 获取菜品详情
 */
function getDishDetail(dishId) {
  return callFunction('getDishDetail', { dishId })
}

/**
 * 保存菜品（新建或更新）
 */
function saveDish(dish) {
  return callFunction('saveDish', { dish })
}

/**
 * 删除菜品（软删除）
 */
function deleteDish(dishId) {
  return callFunction('deleteDish', { dishId })
}

/**
 * 下单
 */
function placeOrder(items, note) {
  return callFunction('placeOrder', { items, note })
}

/**
 * 获取订单列表
 */
function getOrders(role, status, page = 1, pageSize = 10) {
  return callFunction('getOrders', { role, status, page, pageSize })
}

/**
 * 更新订单状态
 */
function updateOrderStatus(orderId, newStatus) {
  return callFunction('updateOrderStatus', { orderId, newStatus })
}

/**
 * 保存分类（新建或更新）
 */
function saveCategory(category) {
  return callFunction('saveCategory', { category })
}

/**
 * 删除分类
 */
function deleteCategory(categoryId) {
  return callFunction('saveCategory', { action: 'delete', categoryId })
}

/**
 * 调整星星币
 */
function adjustStarCoins(targetUserId, amount, reason) {
  return callFunction('adjustStarCoins', { targetUserId, amount, reason })
}

/**
 * 监听订单变化（实时）
 */
function watchOrder(orderId, onChange) {
  return createPollWatcher(
    () => callFunction('getOrders', { orderId }),
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
  callFunction,
  getUserInfo,
  getMenu,
  getDishDetail,
  saveDish,
  deleteDish,
  placeOrder,
  getOrders,
  updateOrderStatus,
  saveCategory,
  deleteCategory,
  adjustStarCoins,
  watchOrder,
  watchNewOrders,
  uploadImage
}
