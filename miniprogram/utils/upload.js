/**
 * 图片上传工具 - 上传到 Go 服务并落到 MinIO
 */

const api = require('./api')

// ─── 工具函数 ────────────────────────────────────────────

/**
 * 压缩图片
 * @param {string} filePath - 临时文件路径
 * @param {number} quality - 压缩质量 0-100，默认 80
 * @returns {Promise<string>} 压缩后的临时文件路径
 */
function compressImage(filePath, quality = 80) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => {
        console.log('[Upload] 图片压缩完成:', res.tempFilePath)
        resolve(res.tempFilePath)
      },
      fail: (err) => {
        console.warn('[Upload] 图片压缩失败，使用原图:', err)
        resolve(filePath)
      }
    })
  })
}

// ─── 上传 ────────────────────────────────────────────────

/**
 * 上传图片到后端，后端负责写入 MinIO
 * @param {string} filePath - 本地图片路径
 * @param {Object} options - 可选配置
 * @param {number} options.quality - 压缩质量 0-100，默认 80
 * @param {boolean} options.compress - 是否压缩，默认 true
 * @returns {Promise<string>} 上传后的图片 URL
 */
async function uploadImage(filePath, options = {}) {
  const { quality = 80, compress = true } = options

  if (isRemoteUrl(filePath)) {
    return filePath
  }

  let uploadPath = filePath
  if (compress) {
    uploadPath = await compressImage(filePath, quality)
  }

  const res = await api.uploadFile(uploadPath)
  if (!res || !res.url) {
    throw new Error('上传失败，未返回图片地址')
  }

  console.log('[Upload] 上传成功:', res.url)
  return res.url
}

/**
 * 批量上传图片（串行，避免弱网下并发上传失败）
 * @param {Array<{filePath: string, index: number}>} items - 待上传项
 * @param {Object} options - 上传选项
 * @param {Function} onProgress - 进度回调 (current, total)
 * @returns {Promise<Array<{index: number, url: string}>>} 上传结果
 */
async function batchUpload(items, options = {}, onProgress) {
  const results = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (onProgress) onProgress(i + 1, items.length)
    const url = await uploadImage(item.filePath, options)
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
  compressImage,
  isRemoteUrl,
  hasToken
}
