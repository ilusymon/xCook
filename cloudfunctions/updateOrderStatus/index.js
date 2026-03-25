const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 合法的状态转换
const VALID_TRANSITIONS = {
  placed: ['accepted', 'cancelled'],
  accepted: ['cooking', 'cancelled'],
  cooking: ['done']
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { orderId, newStatus } = event

  if (!orderId || !newStatus) {
    return { success: false, message: '参数不完整' }
  }

  // 获取当前订单
  const orderRes = await db.collection('orders').doc(orderId).get()
  const order = orderRes.data

  if (!order) {
    return { success: false, message: '订单不存在' }
  }

  // 验证状态转换合法性
  const allowed = VALID_TRANSITIONS[order.status]
  if (!allowed || !allowed.includes(newStatus)) {
    return { success: false, message: `不能从 ${order.status} 转为 ${newStatus}` }
  }

  const now = new Date()

  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: newStatus,
      statusHistory: _.push({
        status: newStatus,
        timestamp: now,
        by: OPENID
      }),
      updatedAt: now
    }
  })

  // 如果取消，退还星星币
  if (newStatus === 'cancelled') {
    await db.collection('users').doc(order.userId).update({
      data: {
        starCoins: _.inc(order.totalPrice),
        coinLog: _.push({
          type: 'credit',
          amount: order.totalPrice,
          reason: `订单 ${order.orderNumber} 取消退回`,
          orderId: orderId,
          timestamp: now
        }),
        updatedAt: now
      }
    })
  }

  return { success: true }
}
