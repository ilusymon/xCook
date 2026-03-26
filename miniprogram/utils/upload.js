/**
 * 图片上传工具 - 使用 GitCode 仓库作为图床
 * 压缩图片后转 base64 上传至 GitCode 仓库，返回 raw URL
 *
 * GitCode API (v5):
 *   POST /api/v5/repos/{owner}/{repo}/contents/{path}
 *   Authorization: Bearer {token}
 *   Body: { content (base64), message, branch }
 *   Raw URL: https://raw.gitcode.com/{owner}/{repo}/raw/{branch}/{path}
 */

// ─── 配置 ───────────────────────────────────────────────
const GITCODE_API_BASE = 'https://api.gitcode.com/api/v5/repos'
const GITCODE_RAW_BASE = 'https://raw.gitcode.com'

let GITCODE_OWNER = ''
let GITCODE_REPO = ''
let GITCODE_BRANCH = 'main'
let GITCODE_TOKEN = ''

try {
  const secret = require('../config/secret.config')
  GITCODE_OWNER = secret.GITCODE_OWNER || ''
  GITCODE_REPO = secret.GITCODE_REPO || ''
  GITCODE_BRANCH = secret.GITCODE_BRANCH || 'main'
  GITCODE_TOKEN = secret.GITCODE_TOKEN || ''
} catch (e) {
  console.warn('[Upload] 未找到 secret.config.js，图片上传不可用。请参照 secret.config.example.js 创建配置文件。')
}

// ─── 工具函数 ────────────────────────────────────────────

/**
 * 生成唯一文件名: images/20260326/143012_a1b2c3.jpg
 * @param {string} ext - 文件扩展名
 * @returns {string}
 */
function generateFilePath(ext = 'jpg') {
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')
  const rand = Math.random().toString(36).slice(2, 8)
  return `images/${date}/${time}_${rand}.${ext}`
}

/**
 * 从文件路径推断扩展名
 * @param {string} filePath
 * @returns {string}
 */
function getExtension(filePath) {
  const match = filePath.match(/\.(\w+)$/)
  if (match) {
    const ext = match[1].toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return ext
  }
  return 'jpg'
}

/**
 * 读取本地文件为 base64
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: (err) => reject(new Error('读取文件失败: ' + (err.errMsg || JSON.stringify(err))))
    })
  })
}

// ─── 压缩 ────────────────────────────────────────────────

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
 * 上传图片到 GitCode 仓库图床
 * @param {string} filePath - 本地图片路径
 * @param {Object} options - 可选配置
 * @param {number} options.quality - 压缩质量 0-100，默认 80
 * @param {boolean} options.compress - 是否压缩，默认 true
 * @returns {Promise<string>} 上传后的图片 raw URL
 */
async function uploadImage(filePath, options = {}) {
  const { quality = 80, compress = true } = options

  // 已经是远程图片，直接返回
  if (isRemoteUrl(filePath)) {
    return filePath
  }

  // 检查配置
  if (!GITCODE_TOKEN || !GITCODE_OWNER || !GITCODE_REPO) {
    throw new Error('GitCode 图床未配置，请在 secret.config.js 中设置 GITCODE_TOKEN/OWNER/REPO')
  }

  // 压缩图片
  let uploadPath = filePath
  if (compress) {
    uploadPath = await compressImage(filePath, quality)
  }

  // 读取文件为 base64
  const base64Content = await readFileAsBase64(uploadPath)

  // 生成远程文件路径
  const ext = getExtension(filePath)
  const remotePath = generateFilePath(ext)

  // 调用 GitCode API 创建文件
  const apiUrl = `${GITCODE_API_BASE}/${GITCODE_OWNER}/${GITCODE_REPO}/contents/${remotePath}`

  console.log('[Upload] 开始上传到 GitCode:', remotePath, ', 大小:', Math.round(base64Content.length * 3 / 4 / 1024), 'KB')

  return new Promise((resolve, reject) => {
    wx.request({
      url: apiUrl,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITCODE_TOKEN}`
      },
      data: {
        content: base64Content,
        message: `upload ${remotePath}`,
        branch: GITCODE_BRANCH
      },
      success: (res) => {
        console.log('[Upload] 响应状态码:', res.statusCode)

        if (res.statusCode === 200 || res.statusCode === 201) {
          // 拼接 raw URL
          const rawUrl = `${GITCODE_RAW_BASE}/${GITCODE_OWNER}/${GITCODE_REPO}/raw/${GITCODE_BRANCH}/${remotePath}`
          console.log('[Upload] 上传成功:', rawUrl)
          resolve(rawUrl)
        } else {
          const errMsg = (res.data && (res.data.error_message || res.data.message)) || `HTTP ${res.statusCode}`
          console.error('[Upload] 上传失败:', errMsg, res.data)
          reject(new Error(errMsg))
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
 * 批量上传图片（串行，避免 GitCode 并发冲突）
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
 * 微信临时文件路径: http://tmp/xxx, wxfile://xxx → 本地
 * @param {string} url
 * @returns {boolean}
 */
function isRemoteUrl(url) {
  if (!url) return false
  // 微信本地临时文件
  if (url.startsWith('http://tmp/') || url.startsWith('http://tmp_')) return false
  if (url.startsWith('wxfile://')) return false
  // 微信云存储
  if (url.startsWith('cloud://')) return true
  // 真正的远程 URL
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://') && !url.startsWith('http://usr/') && !url.startsWith('http://store/')) return true
  return false
}

/**
 * 获取当前图床配置状态
 * @returns {boolean}
 */
function hasToken() {
  return !!(GITCODE_TOKEN && GITCODE_OWNER && GITCODE_REPO)
}

module.exports = {
  uploadImage,
  batchUpload,
  compressImage,
  isRemoteUrl,
  hasToken
}
