const api = require('./api')

function resolveMediaUrl(path) {
  if (!path) return ''
  if (isAbsoluteUrl(path) || isLocalPath(path)) {
    return path
  }

  const base = api.getImageBaseUrl()
  if (!base) {
    return path
  }

  return `${base}/${String(path).replace(/^\/+/, '')}`
}

function toMediaPath(value) {
  if (!value) return ''
  if (isLocalPath(value) || value.startsWith('cloud://')) {
    return value
  }
  if (!isAbsoluteUrl(value)) {
    return String(value).replace(/^\/+/, '')
  }

  const base = api.getImageBaseUrl()
  if (base && value.startsWith(`${base}/`)) {
    return value.slice(base.length + 1)
  }

  return value
}

function normalizeDish(dish) {
  if (!dish) return dish
  const normalized = { ...dish }
  normalized.coverImage = resolveMediaUrl(normalized.coverImage)
  normalized.steps = Array.isArray(normalized.steps)
    ? normalized.steps.map(step => ({
      ...step,
      image: resolveMediaUrl(step.image)
    }))
    : []
  return normalized
}

function denormalizeDish(dish) {
  if (!dish) return dish
  const normalized = { ...dish }
  normalized.coverImage = toMediaPath(normalized.coverImage)
  normalized.steps = Array.isArray(normalized.steps)
    ? normalized.steps.map(step => ({
      ...step,
      image: toMediaPath(step.image)
    }))
    : []
  return normalized
}

function normalizeOrder(order) {
  if (!order) return order
  return {
    ...order,
    items: Array.isArray(order.items)
      ? order.items.map(item => ({
        ...item,
        coverImage: resolveMediaUrl(item.coverImage)
      }))
      : []
  }
}

function normalizeMenuResponse(res) {
  if (!res) return res
  const dishes = {}
  Object.keys(res.dishes || {}).forEach(key => {
    dishes[key] = (res.dishes[key] || []).map(normalizeDish)
  })
  return {
    ...res,
    dishes
  }
}

function normalizeOrdersResponse(res) {
  if (!res) return res
  return {
    ...res,
    orders: Array.isArray(res.orders) ? res.orders.map(normalizeOrder) : []
  }
}

function normalizeOrderDetailResponse(res) {
  if (!res) return res
  return {
    ...res,
    order: normalizeOrder(res.order)
  }
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//.test(value)
}

function isLocalPath(value) {
  return value.startsWith('wxfile://') ||
    value.startsWith('http://tmp/') ||
    value.startsWith('http://tmp_') ||
    value.startsWith('http://usr/') ||
    value.startsWith('http://store/')
}

module.exports = {
  resolveMediaUrl,
  toMediaPath,
  normalizeDish,
  denormalizeDish,
  normalizeMenuResponse,
  normalizeOrdersResponse,
  normalizeOrderDetailResponse
}
