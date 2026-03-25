const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { items, note } = event

  if (!items || items.length === 0) {
    return { success: false, message: '购物车为空' }
  }

  // 服务端重新计算总价（不信任客户端）
  let totalPrice = 0
  let totalCalories = 0
  const verifiedItems = []

  for (const item of items) {
    const dishRes = await db.collection('dishes').doc(item.dishId).get()
    const dish = dishRes.data

    if (!dish || dish.isDeleted || !dish.isAvailable) {
      return { success: false, message: `菜品「${item.dishName}」已下架` }
    }

    // 计算加价
    let extraPrice = 0
    if (item.selectedOptions && dish.optionGroups) {
      Object.entries(item.selectedOptions).forEach(([groupName, selected]) => {
        const group = dish.optionGroups.find(g => g.groupName === groupName)
        if (group) {
          const selectedArr = Array.isArray(selected) ? selected : [selected]
          group.options.forEach(opt => {
            if (selectedArr.includes(opt.value) || selectedArr.includes(opt.label)) {
              extraPrice += opt.extraPrice || 0
            }
          })
        }
      })
    }

    const itemTotal = (dish.price + extraPrice) * item.quantity
    totalPrice += itemTotal
    totalCalories += (dish.calories || 0) * item.quantity

    verifiedItems.push({
      dishId: dish._id,
      dishName: dish.name,
      coverImage: dish.coverImage,
      unitPrice: dish.price,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions || {},
      extraPrice,
      itemTotal,
      calories: dish.calories || 0
    })
  }

  // 检查余额
  const userRes = await db.collection('users').doc(OPENID).get()
  const user = userRes.data

  if (user.starCoins < totalPrice) {
    return { success: false, message: '星星币不足' }
  }

  // 生成订单号
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase()
  const orderNumber = `XC${y}${m}${d}${rand}`

  // 创建订单
  const order = {
    orderNumber,
    userId: OPENID,
    status: 'placed',
    items: verifiedItems,
    totalPrice,
    totalCalories,
    note: note || '',
    statusHistory: [
      { status: 'placed', timestamp: now, by: OPENID }
    ],
    createdAt: now,
    updatedAt: now
  }

  const orderRes = await db.collection('orders').add({ data: order })

  // 扣除星星币（原子操作）
  await db.collection('users').doc(OPENID).update({
    data: {
      starCoins: _.inc(-totalPrice),
      coinLog: _.push({
        type: 'debit',
        amount: totalPrice,
        reason: `订单 ${orderNumber}`,
        orderId: orderRes._id,
        timestamp: now
      }),
      updatedAt: now
    }
  })

  return {
    success: true,
    orderId: orderRes._id,
    orderNumber,
    remainingCoins: user.starCoins - totalPrice
  }
}
