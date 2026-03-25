/**
 * 格式化工具函数
 */

/**
 * 格式化星星币价格
 */
function formatPrice(price) {
  return Number(price).toFixed(0)
}

/**
 * 格式化卡路里
 */
function formatCalories(cal) {
  if (cal >= 1000) {
    return (cal / 1000).toFixed(1) + 'kcal'
  }
  return cal + 'kcal'
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hour = d.getHours().toString().padStart(2, '0')
  const minute = d.getMinutes().toString().padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化完整日期
 */
function formatFullDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hour = d.getHours().toString().padStart(2, '0')
  const minute = d.getMinutes().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化制作时间
 */
function formatDuration(minutes) {
  if (!minutes) return ''
  if (minutes < 60) return minutes + '分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
}

/**
 * 生成订单号
 */
function generateOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `XC${y}${m}${d}${rand}`
}

/**
 * 格式化相对时间（如 "3分钟前"）
 */
function formatRelativeTime(date) {
  if (!date) return ''
  const now = Date.now()
  const d = new Date(date).getTime()
  const diff = Math.floor((now - d) / 1000)

  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
  return formatDate(date)
}

module.exports = {
  formatPrice,
  formatCalories,
  formatDate,
  formatFullDate,
  formatDuration,
  generateOrderNumber,
  formatRelativeTime
}
