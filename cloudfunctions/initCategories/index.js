const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_CATEGORIES = [
  { name: '荤菜', icon: 'meat', sortOrder: 1, isActive: true },
  { name: '素菜', icon: 'vegetable', sortOrder: 2, isActive: true },
  { name: '汤品', icon: 'soup', sortOrder: 3, isActive: true },
  { name: '主食', icon: 'staple', sortOrder: 4, isActive: true },
  { name: '甜品', icon: 'dessert', sortOrder: 5, isActive: true },
  { name: '饮品', icon: 'drink', sortOrder: 6, isActive: true }
]

exports.main = async () => {
  // 检查是否已初始化
  const count = await db.collection('categories').count()
  if (count.total > 0) {
    return { success: true, message: '分类已存在，跳过初始化' }
  }

  const now = new Date()
  const tasks = DEFAULT_CATEGORIES.map(cat => {
    return db.collection('categories').add({
      data: {
        ...cat,
        createdAt: now,
        updatedAt: now
      }
    })
  })

  await Promise.all(tasks)
  return { success: true, message: `已初始化 ${DEFAULT_CATEGORIES.length} 个分类` }
}
