let secretConfig = {}
try {
  secretConfig = require('../config/secret.config')
} catch (e) {
  console.warn('未找到 secret.config.js，请参照 secret.config.example.js 创建配置文件')
}

const API_BASE_URL = (secretConfig.API_BASE_URL || '').replace(/\/$/, '')
const DEBUG_OPEN_ID = secretConfig.DEBUG_OPEN_ID || ''
const POLL_INTERVAL = Number(secretConfig.POLL_INTERVAL || 5000)
const TOKEN_KEY = 'xcook_token'

let loginPromise = null

function getBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('请在 miniprogram/config/secret.config.js 中配置 API_BASE_URL')
  }
  return API_BASE_URL
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
}

function rawRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
    })
  })
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code)
        } else {
          reject(new Error('微信登录失败'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '微信登录失败'))
    })
  })
}

function ensureSession(forceRefresh = false) {
  if (!forceRefresh) {
    const token = getToken()
    if (token) {
      return Promise.resolve(token)
    }
  }

  if (loginPromise) {
    return loginPromise
  }

  const loginTask = DEBUG_OPEN_ID
    ? Promise.resolve({
      debugOpenId: DEBUG_OPEN_ID
    })
    : wxLogin().then((code) => ({ code }))

  loginPromise = loginTask
    .then((data) => rawRequest({
      url: `${getBaseUrl()}/api/auth/login`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data
    }))
    .then((res) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.token) {
        setToken(res.data.token)
        return res.data.token
      }
      throw new Error((res.data && res.data.message) || '登录失败')
    })
    .finally(() => {
      loginPromise = null
    })

  return loginPromise
}

function request(options, retried) {
  const authRequired = options.auth !== false

  return Promise.resolve()
    .then(() => authRequired ? ensureSession() : '')
    .then(() => {
      const header = Object.assign({}, options.header || {})
      if (authRequired) {
        header.Authorization = `Bearer ${getToken()}`
      }

      return rawRequest({
        url: `${getBaseUrl()}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header
      })
    })
    .then((res) => {
      if (res.statusCode === 401 && authRequired && !retried) {
        clearToken()
        return ensureSession(true).then(() => request(options, true))
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data
      }

      throw new Error((res.data && res.data.message) || `请求失败(${res.statusCode})`)
    })
}

function uploadFile(filePath, formData = {}, retried) {
  return ensureSession()
    .then(() => new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${getBaseUrl()}/api/uploads/images`,
        filePath,
        name: 'file',
        formData,
        header: {
          Authorization: `Bearer ${getToken()}`
        },
        success: (res) => {
          let data = {}
          try {
            data = JSON.parse(res.data || '{}')
          } catch (e) {
            reject(new Error('上传返回格式错误'))
            return
          }

          if (res.statusCode === 401 && !retried) {
            clearToken()
            ensureSession(true).then(() => {
              uploadFile(filePath, formData, true).then(resolve).catch(reject)
            }).catch(reject)
            return
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data)
            return
          }

          reject(new Error(data.message || '上传失败'))
        },
        fail: (err) => reject(new Error(err.errMsg || '上传失败'))
      })
    }))
}

module.exports = {
  request,
  uploadFile,
  ensureSession,
  clearToken,
  getToken,
  getBaseUrl,
  POLL_INTERVAL
}
