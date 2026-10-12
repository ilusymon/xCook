/**
 * 图片上传工具 - 上传到 Go 服务并落到 MinIO
 */

const api = require('./api')
const media = require('./media')

// ─── 上传 ────────────────────────────────────────────────

/**
 * 上传原图到后端，由后端压缩并保存两份图片
 * @param {string} filePath - 本地图片路径
 * @returns {Promise<string>} 压缩图访问地址
 */
async function uploadImage(filePath) {
  if (isRemoteUrl(filePath)) {
    return filePath
  }

  const res = await api.uploadFile(filePath)
  if (!res || !res.path) {
    throw new Error('上传失败，未返回图片地址')
  }

  const imageUrl = media.resolveMediaUrl(res.path)
  console.log('[Upload] 上传成功:', imageUrl)
  return imageUrl
}

/**
 * 批量上传图片（串行，避免弱网下并发上传失败）
 * @param {Array<{filePath: string, index: number}>} items - 待上传项
 * @param {Object} _options - 已废弃参数，保留进度回调的位置
 * @param {Function} onProgress - 进度回调 (current, total)
 * @returns {Promise<Array<{index: number, url: string}>>} 上传结果
 */
async function batchUpload(items, _options = {}, onProgress) {
  const results = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (onProgress) onProgress(i + 1, items.length)
    const url = await uploadImage(item.filePath)
    results.push({ index: item.index, url })
  }
  return results
}

// ─── 判断 ────────────────────────────────────────────────

/**
 * 判断是否为已上传的远程 URL
 * @param {string} url
 * @returns {boolean}
 */
function isRemoteUrl(url) {
  if (!url) return false
  // 微信本地临时文件
  if (url.startsWith('http://tmp/') || url.startsWith('http://tmp_')) return false
  if (url.startsWith('wxfile://')) return false
  if (url.startsWith('cloud://')) return true
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://') && !url.startsWith('http://usr/') && !url.startsWith('http://store/')) return true
  return false
}

/**
 * 获取当前图床配置状态
 * @returns {boolean}
 */
function hasToken() {
  try {
    return !!api.getBaseUrl()
  } catch (e) {
    return false
  }
}

module.exports = {
  uploadImage,
  batchUpload,
  isRemoteUrl,
  hasToken
}
