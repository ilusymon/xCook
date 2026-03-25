const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { dishId } = event
  if (!dishId) return { success: false, message: '缺少菜品ID' }

  await db.collection('dishes').doc(dishId).update({
    data: {
      isDeleted: true,
      updatedAt: new Date()
    }
  })

  return { success: true }
}
