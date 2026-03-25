const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action, category } = event

  // 删除分类
  if (action === 'delete') {
    const { categoryId } = event
    // 检查分类下是否有菜品
    const dishCount = await db.collection('dishes').where({
      categoryId,
      isDeleted: db.command.not(db.command.eq(true))
    }).count()
    if (dishCount.total > 0) {
      return { success: false, message: `该分类下还有 ${dishCount.total} 道菜品，请先移除` }
    }
    await db.collection('categories').doc(categoryId).remove()
    return { success: true }
  }

  // 新建或更新分类
  const now = new Date()
  if (category._id) {
    // 更新
    const id = category._id
    delete category._id
    await db.collection('categories').doc(id).update({
      data: {
        ...category,
        updatedAt: now
      }
    })
    return { success: true, id }
  } else {
    // 新建 — 自动排到最后
    const maxSort = await db.collection('categories')
      .orderBy('sortOrder', 'desc')
      .limit(1)
      .get()
    const nextSort = maxSort.data.length > 0 ? maxSort.data[0].sortOrder + 1 : 1

    const res = await db.collection('categories').add({
      data: {
        name: category.name || '新分类',
        icon: category.icon || 'default',
        sortOrder: nextSort,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    })
    return { success: true, id: res._id }
  }
}
