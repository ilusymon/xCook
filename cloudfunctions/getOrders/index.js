const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { role, status, page = 1, pageSize = 10, orderId } = event

  // 查询单个订单
  if (orderId) {
    const res = await db.collection('orders').doc(orderId).get()
    return { order: res.data }
  }

  // 构建查询条件
  const where = {}

  if (role === 'chef') {
    // 厨师看所有订单
  } else {
    // 点菜人只看自己的订单
    where.userId = OPENID
  }

  // 状态筛选
  if (status === 'active') {
    where.status = _.in(['placed', 'accepted', 'cooking'])
  } else if (status === 'done') {
    where.status = 'done'
  } else if (status === 'placed') {
    where.status = 'placed'
  } else if (status === 'cooking') {
    where.status = _.in(['accepted', 'cooking'])
  } else if (status && status !== '') {
    where.status = status
  }

  // 获取总数
  const countRes = await db.collection('orders').where(where).count()
  const total = countRes.total

  // 分页查询
  const skip = (page - 1) * pageSize
  const res = await db.collection('orders')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  return {
    orders: res.data,
    total,
    hasMore: skip + res.data.length < total
  }
}
