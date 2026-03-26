/**
 * 图片上传工具 - 使用 helloimg.com 第三方图床
 * 支持压缩后上传，返回图片 URL
 */

// 图床 API 配置
const UPLOAD_API = 'https://www.helloimg.com/api/v1/upload'

// 从私有配置文件读取 Token（该文件被 .gitignore 排除，不会提交到仓库）
let API_TOKEN = ''
try {
  const secret = require('../config/secret.config')
  API_TOKEN = secret.HELLOIMG_TOKEN || ''
} catch (e) {
  console.warn('[Upload] 未找到 secret.config.js，图片将以游客身份上传。请参照 secret.config.example.js 创建配置文件。')
}

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
        // 压缩失败时回退到原图
        resolve(filePath)
      }
    })
  })
}

/**
 * 上传图片到 helloimg.com 图床
 * @param {string} filePath - 本地图片路径（临时文件或本地路径）
 * @param {Object} options - 可选配置
 * @param {number} options.quality - 压缩质量 0-100，默认 80
 * @param {boolean} options.compress - 是否压缩，默认 true
 * @returns {Promise<string>} 上传后的图片 URL
 */
async function uploadImage(filePath, options = {}) {
  const { quality = 80, compress = true } = options

  // 如果已经是网络图片，直接返回
  if (isRemoteUrl(filePath)) {
    return filePath
  }

  // 压缩图片
  let uploadPath = filePath
  if (compress) {
    uploadPath = await compressImage(filePath, quality)
  }

  // 上传到图床
  return new Promise((resolve, reject) => {
    const header = {
      'Accept': 'application/json'
    }
    if (API_TOKEN) {
      header['Authorization'] = `Bearer ${API_TOKEN}`
    }

    console.log('[Upload] 开始上传, Token:', API_TOKEN ? '已配置' : '未配置', ', 文件:', uploadPath)

    wx.uploadFile({
      url: UPLOAD_API,
      filePath: uploadPath,
      name: 'file',
      header,
      formData: {
        permission: '1'  // 公开访问
      },
      success: (res) => {
        console.log('[Upload] 响应状态码:', res.statusCode)
        console.log('[Upload] 响应内容:', res.data)

        if (res.statusCode !== 200) {
          let errMsg = `HTTP ${res.statusCode}`
          try {
            const errData = JSON.parse(res.data)
            errMsg = errData.message || errMsg
          } catch (e) {}
          console.error('[Upload] 请求失败:', errMsg)
          reject(new Error(errMsg))
          return
        }

        try {
          const data = JSON.parse(res.data)
          if (data.status === true && data.data && data.data.links) {
            const imageUrl = data.data.links.url
            console.log('[Upload] 上传成功:', imageUrl)
            resolve(imageUrl)
          } else {
            const errMsg = (data && data.message) || '上传失败'
            console.error('[Upload] 接口返回错误:', errMsg, data)
            reject(new Error(errMsg))
          }
        } catch (e) {
          console.error('[Upload] 解析响应失败:', res.data)
          reject(new Error('解析上传响应失败'))
        }
      },
      fail: (err) => {
        console.error('[Upload] 网络请求失败:', JSON.stringify(err))
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

/**
 * 批量上传图片
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

/**
 * 判断是否为远程 URL（已上传的图片）
 * @param {string} url
 * @returns {boolean}
 */
function isRemoteUrl(url) {
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('cloud://')
}

/**
 * 获取当前 API Token 配置状态
 * @returns {boolean}
 */
function hasToken() {
  return !!API_TOKEN
}

module.exports = {
  uploadImage,
  batchUpload,
  compressImage,
  isRemoteUrl,
  hasToken,
  UPLOAD_API
}
