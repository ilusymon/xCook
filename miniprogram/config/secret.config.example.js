/**
 * 敏感配置模板
 *
 * 使用方法：
 * 1. 复制本文件并重命名为 secret.config.js
 *    cp secret.config.example.js secret.config.js
 * 2. 填入你的真实密钥
 * 3. secret.config.js 已被 .gitignore 排除，不会被提交到仓库
 *
 * 注意：project.config.json 中的 appid 需要手动修改为你的小程序 AppID
 */

module.exports = {
  // 微信云开发环境 ID
  // 获取方式：微信开发者工具 -> 云开发控制台 -> 设置 -> 环境 ID
  CLOUD_ENV: '',

  // helloimg.com 图床 API Token
  // 获取方式：注册 https://www.helloimg.com -> 个人中心 -> API Token
  HELLOIMG_TOKEN: '',
}
