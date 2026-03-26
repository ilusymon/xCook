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

  // GitCode 图床配置
  // 获取方式：在 https://gitcode.com 创建一个公开仓库用于存放图片
  // 然后在 个人设置 -> 安全设置 -> 私人令牌 中创建 Token
  GITCODE_OWNER: '',       // GitCode 用户名
  GITCODE_REPO: '',        // 仓库名（需要是公开仓库）
  GITCODE_BRANCH: 'main',  // 分支名
  GITCODE_TOKEN: '',       // 私人令牌（需要 projects 权限）
}
