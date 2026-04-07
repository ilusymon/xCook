# 星厨房

> 属于我们的小厨房

星厨房是一款面向情侣的私人点餐微信小程序。一方在「点菜端」浏览菜单、选择口味、下单；另一方在「厨师端」管理菜品、接单烹饪。使用虚拟「星星币」支付，不接入真实支付。

当前版本已将原来的「微信云开发 + 云函数 + 云数据库 + GitCode 图床」方案，替换为：

- `Go` 后端服务
- `MySQL` 业务数据库
- `MinIO` 图片存储
- 小程序侧 `HTTP API + 轮询` 替代 `wx.cloud + watch`

## 功能特性

### 点菜端
- 分类浏览，快速查看想吃的菜
- 口味/加料选项选择，支持单选、多选、加价
- 购物车与星星币结算
- 订单列表与订单详情状态跟踪

### 厨师端
- 分类管理：新增、编辑、排序、启停、删除
- 菜品管理：新增、编辑、上下架、软删除
- 食材、步骤、视频配置
- 订单管理：接单、开始制作、完成

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序原生框架 |
| UI 组件 | iView Weapp |
| 后端 | Go + Gin |
| 数据库 | MySQL + GORM |
| 图片存储 | MinIO |
| 鉴权 | 微信登录 + JWT |
| 实时更新 | 小程序轮询 |

## 项目结构

```text
xCook/
├── backend/                  # Go 后端
│   ├── cmd/api/              # 服务启动入口
│   ├── internal/             # 配置、鉴权、模型、业务、上传
│   └── .env.example
├── miniprogram/              # 微信小程序
├── cloudfunctions/           # 旧云函数实现（保留作迁移参考）
├── design.md                 # 技术设计文档
└── docker-compose.yml        # MySQL / MinIO 本地依赖
```

## 快速开始

### 1. 启动基础服务

在项目根目录运行：

```bash
docker compose up -d
```

启动后：

- MySQL: `127.0.0.1:3306`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`

### 2. 配置后端

```bash
cd backend
cp .env.example .env
```

按需修改 `.env`：

- `MYSQL_*` 指向你的 MySQL
- `MINIO_*` 指向你的 MinIO
- `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 填小程序后台配置
- 本地联调时可先保留 `WECHAT_ALLOW_DEBUG_AUTH=true`

### 3. 启动后端

```bash
cd backend
go run ./cmd/api
```

服务默认监听 `http://127.0.0.1:8080`。

### 4. 配置小程序

复制配置模板：

```bash
cd miniprogram/config
cp secret.config.example.js secret.config.js
```

编辑 `secret.config.js`：

- `API_BASE_URL`: 后端地址
- `POLL_INTERVAL`: 订单轮询间隔，默认 `5000`
- `DEBUG_OPEN_ID`: 本地调试可填一个固定值；正式环境留空

如果是真机调试，请把 `API_BASE_URL` 改成你电脑的局域网 IP，而不是 `127.0.0.1`。

### 5. 安装前端依赖

```bash
cd miniprogram
npm install
```

然后在微信开发者工具中执行“工具 -> 构建 npm”。

### 6. 初始化默认分类

后端启动后，任选一种方式初始化：

1. 登录小程序后调用 `initCategories`
2. 使用接口调试工具请求：

```text
POST /api/functions/initCategories
Authorization: Bearer <token>
```

## 主要接口

### 登录与上传
- `POST /api/auth/login`：微信登录换取 JWT
- `POST /api/uploads/images`：上传图片到 MinIO

### 业务接口

后端保留了与原云函数同名的函数分发入口，便于小程序平滑迁移：

- `POST /api/functions/getUserInfo`
- `POST /api/functions/getMenu`
- `POST /api/functions/getDishDetail`
- `POST /api/functions/saveDish`
- `POST /api/functions/deleteDish`
- `POST /api/functions/placeOrder`
- `POST /api/functions/getOrders`
- `POST /api/functions/updateOrderStatus`
- `POST /api/functions/adjustStarCoins`
- `POST /api/functions/initCategories`
- `POST /api/functions/saveCategory`

## 迁移说明

- `miniprogram/utils/cloud.js` 已改为 HTTP API 封装，页面调用方式基本不变
- `miniprogram/utils/upload.js` 已改为上传到后端，再由后端写入 MinIO
- 原来的 `watch` 实时监听已替换为前端轮询
- `cloudfunctions/` 目录保留，仅用于参考原始业务逻辑

## 注意事项

- 正式环境必须配置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`
- 本地开发若使用真机，请在小程序后台配置合法 request 域名
- MinIO 返回的是公开访问 URL，建议给存储桶配置只读访问
- 当前项目默认通过 GORM `AutoMigrate` 自动建表

## License

MIT
