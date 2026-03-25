const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { dish } = event

  if (!dish) return { success: false, message: '缺少菜品数据' }

  const now = new Date()

  if (dish._id) {
    // 更新
    const dishId = dish._id
    delete dish._id
    dish.updatedAt = now

    await db.collection('dishes').doc(dishId).update({ data: dish })
    return { success: true, dishId }
  } else {
    // 新建
    dish.createdBy = OPENID
    dish.isDeleted = false
    dish.isAvailable = dish.isAvailable !== false
    dish.createdAt = now
    dish.updatedAt = now

    const res = await db.collection('dishes').add({ data: dish })
    return { success: true, dishId: res._id }
  }
}
