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
  // Go 后端地址
  // 真机调试请改成你的局域网 IP，例如 http://192.168.1.10:8080
  API_BASE_URL: 'http://127.0.0.1:8080',

  // 轮询间隔（毫秒）
  POLL_INTERVAL: 5000,

  // 本地联调时可选，用于后端开启 WECHAT_ALLOW_DEBUG_AUTH=true 的场景
  DEBUG_OPEN_ID: '',
}
