const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 查找用户
  const userRes = await db.collection('users').where({ openid: OPENID }).get()

  if (userRes.data.length > 0) {
    return userRes.data[0]
  }

  // 新用户，创建记录
  const newUser = {
    _id: OPENID,
    openid: OPENID,
    nickName: '',
    avatarUrl: '',
    role: 'both',
    starCoins: 100,
    coinLog: [
      { type: 'credit', amount: 100, reason: '初始赠送', timestamp: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  await db.collection('users').add({ data: newUser })
  return newUser
}
