/**
 * 云开发数据库 & 云函数调用封装
 */

const db = wx.cloud.database()
const _ = db.command

// 集合引用
const collections = {
  categories: db.collection('categories'),
  dishes: db.collection('dishes'),
  orders: db.collection('orders'),
  users: db.collection('users')
}

/**
 * 调用云函数
 */
function callFunction(name, data = {}) {
  return wx.cloud.callFunction({ name, data }).then(res => res.result)
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
  return collections.orders.where({ _id: orderId }).watch({
    onChange(snapshot) {
      if (snapshot.docs.length > 0) {
        onChange(snapshot.docs[0])
      }
    },
    onError(err) {
      console.error('监听订单失败', err)
    }
  })
}

/**
 * 监听新订单（厨师端）
 */
function watchNewOrders(onChange) {
  return collections.orders.where({ status: 'placed' }).watch({
    onChange(snapshot) {
      onChange(snapshot.docs)
    },
    onError(err) {
      console.error('监听新订单失败', err)
    }
  })
}

/**
 * 上传图片到云存储
 */
function uploadImage(filePath, cloudPath) {
  return wx.cloud.uploadFile({
    cloudPath,
    filePath
  }).then(res => res.fileID)
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
