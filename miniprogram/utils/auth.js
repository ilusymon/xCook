/**
 * 用户角色与权限工具
 */

const app = getApp()

/**
 * 获取当前用户角色
 */
function getRole() {
  return app.globalData.role || 'both'
}

/**
 * 是否为厨师
 */
function isChef() {
  const role = getRole()
  return role === 'chef' || role === 'both'
}

/**
 * 是否为点菜人
 */
function isOrderer() {
  const role = getRole()
  return role === 'orderer' || role === 'both'
}

/**
 * 获取当前 openid
 */
function getOpenid() {
  return app.globalData.openid
}

/**
 * 获取星星币余额
 */
function getStarCoins() {
  return app.globalData.starCoins || 0
}

/**
 * 刷新用户信息
 */
function refreshUserInfo() {
  return app.loadUserInfo()
}

module.exports = {
  getRole,
  isChef,
  isOrderer,
  getOpenid,
  getStarCoins,
  refreshUserInfo
}
