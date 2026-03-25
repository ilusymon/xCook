const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { dishId } = event
  if (!dishId) return null

  const res = await db.collection('dishes').doc(dishId).get()
  return res.data
}
