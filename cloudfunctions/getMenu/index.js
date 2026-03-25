const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { role } = event || {}

  // 获取所有活跃分类
  const catRes = await db.collection('categories')
    .where({ isActive: true })
    .orderBy('sortOrder', 'asc')
    .get()

  const categories = catRes.data

  // 构建菜品查询条件
  // 厨师端：显示所有未删除的菜品（含已下架）
  // 点菜端：仅显示上架且未删除的菜品
  const dishWhere = {}
  if (role === 'chef') {
    // 厨师看全部未删除的（isDeleted 不为 true，或字段不存在）
    dishWhere.isDeleted = _.not(_.eq(true))
  } else {
    // 点菜端只看上架的
    dishWhere.isAvailable = _.not(_.eq(false))
    dishWhere.isDeleted = _.not(_.eq(true))
  }

  const dishRes = await db.collection('dishes')
    .where(dishWhere)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  // 按分类分组
  const dishes = {}
  categories.forEach(cat => {
    dishes[cat._id] = []
  })
  dishRes.data.forEach(dish => {
    if (dishes[dish.categoryId]) {
      dishes[dish.categoryId].push(dish)
    }
  })

  return { categories, dishes }
}
