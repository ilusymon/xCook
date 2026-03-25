const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { targetUserId, amount, reason } = event

  if (!targetUserId || !amount) {
    return { success: false, message: '参数不完整' }
  }

  const now = new Date()
  const type = amount > 0 ? 'credit' : 'debit'

  await db.collection('users').doc(targetUserId).update({
    data: {
      starCoins: _.inc(amount),
      coinLog: _.push({
        type,
        amount: Math.abs(amount),
        reason: reason || (amount > 0 ? '伴侣赠送' : '扣除'),
        by: OPENID,
        timestamp: now
      }),
      updatedAt: now
    }
  })

  return { success: true }
}
