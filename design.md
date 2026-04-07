# 星厨房 情侣点餐微信小程序 — 技术设计文档

## 1. 项目概述

星厨房是一款面向情侣的私人点餐微信小程序。一方在「点菜端」浏览菜单、选择口味、下单；另一方在「厨师端」管理菜品、接单制作。使用虚拟「星星币」作为支付方式，不接入真实支付。

### 1.1 核心目标
- 让情侣间的做饭点餐更有仪式感和趣味性
- 厨师可以完整管理菜品分类、菜品、食材、步骤、视频
- 点菜人可以方便浏览、选择口味、下单并追踪订单
- 将原云开发方案替换为可自部署的 `Go + MySQL + MinIO` 架构

---

## 2. 技术选型

| 层级 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生 MINA 框架 |
| UI 组件库 | iView Weapp |
| 后端 | Go 1.25 + Gin |
| 数据库 | MySQL 8 + GORM |
| 图片存储 | MinIO |
| 鉴权 | `wx.login` + 后端 `code2session` + JWT |
| 实时通信 | 小程序轮询 |

### 2.1 架构说明

- 小程序不再依赖 `wx.cloud`
- 原云函数能力统一由 Go 后端暴露为 HTTP API
- 业务数据从云数据库迁移到 MySQL
- 菜品封面图、步骤图上传至 MinIO
- 原数据库 `watch` 实时监听改为前端定时轮询

---

## 3. 项目结构

```text
xCook/
├── project.config.json
├── package.json
├── design.md
├── README.md
├── docker-compose.yml
│
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       └── main.go            # Go 服务启动入口
│   ├── internal/
│   │   ├── app/                   # 应用装配
│   │   ├── auth/                  # JWT
│   │   ├── config/                # 环境配置
│   │   ├── handler/               # HTTP 处理器
│   │   ├── middleware/            # 登录中间件
│   │   ├── model/                 # GORM 模型
│   │   ├── service/               # 业务逻辑
│   │   ├── storage/               # MinIO 上传
│   │   └── wechat/                # 微信 code2session
│   ├── .env.example
│   └── go.mod
│
├── miniprogram/
│   ├── app.js                     # 全局逻辑（登录、购物车）
│   ├── app.json
│   ├── app.wxss
│   ├── config/
│   │   └── secret.config.js       # 小程序 API 地址等本地配置
│   ├── utils/
│   │   ├── api.js                 # HTTP / 登录态封装
│   │   ├── cloud.js               # 兼容层：页面仍按原函数名调用
│   │   ├── upload.js              # 图片压缩 + 上传到后端
│   │   ├── auth.js
│   │   ├── constants.js
│   │   └── format.js
│   ├── components/
│   └── pages/
│
└── cloudfunctions/                # 旧实现，仅作迁移参考
```

---

## 4. 数据库设计

MySQL 中保留与原业务一致的数据结构，但将数组/对象字段改为 JSON 列存储。

### 4.1 users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键，等于 openid |
| openid | varchar(64) | 微信 openid |
| nick_name | varchar(128) | 昵称 |
| avatar_url | varchar(1024) | 头像 |
| role | varchar(32) | `orderer` / `chef` / `both` |
| star_coins | bigint | 星星币余额，默认 100 |
| coin_log | json | 星星币变动记录 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 4.2 categories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键 |
| name | varchar(64) | 分类名 |
| icon | varchar(64) | 图标标识 |
| sort_order | int | 排序序号 |
| is_active | tinyint | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 4.3 dishes 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键 |
| name | varchar(128) | 菜品名称 |
| description | text | 简短描述 |
| cover_image | varchar(1024) | 封面图 URL（MinIO） |
| category_id | varchar(64) | 所属分类 ID |
| price | bigint | 星星币价格 |
| calories | bigint | 卡路里 |
| preparation_time | int | 制作时间（分钟） |
| difficulty | int | 难度 |
| is_available | tinyint | 是否上架 |
| is_deleted | tinyint | 是否软删除 |
| option_groups | json | 口味选项组 |
| materials | json | 食材清单 |
| steps | json | 制作步骤 |
| video_url | varchar(1024) | 视频链接 |
| created_by | varchar(64) | 创建者 openid |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 4.4 orders 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键 |
| order_number | varchar(32) | 订单号 |
| user_id | varchar(64) | 下单人 openid |
| status | varchar(32) | `placed` / `accepted` / `cooking` / `done` / `cancelled` |
| items | json | 菜品明细 |
| total_price | bigint | 总价 |
| total_calories | bigint | 总热量 |
| note | text | 备注 |
| status_history | json | 状态流转历史 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 4.5 JSON 结构

`optionGroups`、`materials`、`steps`、`items`、`coinLog`、`statusHistory` 保持与原设计一致，便于前端平滑迁移。

---

## 5. 页面设计

页面信息架构与原设计保持一致，不因后端迁移而调整。

### 5.1 点菜端
- 首页：角色选择、余额展示
- 菜单页：左分类右菜品、购物车汇总
- 菜品详情页：封面、描述、难度、选项选择
- 购物车页：增减、删除、汇总
- 结算页：备注、余额校验、下单
- 订单列表页：全部 / 进行中 / 已完成
- 订单详情页：状态进度、明细、取消订单

### 5.2 厨师端
- 厨房首页：待处理数、菜品总数、快捷入口
- 分类管理：增删改排序、启停
- 菜品管理：上下架、编辑、删除
- 菜品编辑：图片、基本信息、选项、材料、步骤、视频
- 烹饪指引：步骤时间线、材料勾选
- 订单管理：接单、开始制作、完成

---

## 6. UI 设计规范

UI 规范与原方案一致：

- 主色：`#FF6B81`
- 辅色：`#FFC048`
- 背景色：`#FFF5F5`
- 卡片圆角：`24rpx`
- 胶囊按钮：`40rpx`
- 柔和阴影 + 轻量动效

---

## 7. 后端 API 设计

### 7.1 登录

`POST /api/auth/login`

请求体：

```json
{
  "code": "wx.login 返回的 code"
}
```

返回：

```json
{
  "token": "jwt-token",
  "user": {
    "_id": "openid",
    "openid": "openid",
    "role": "both",
    "starCoins": 100
  }
}
```

### 7.2 云函数兼容分发

为减少小程序页面改动，后端保留统一函数分发入口：

`POST /api/functions/:name`

支持的 `name`：

- `getUserInfo`
- `getMenu`
- `getDishDetail`
- `saveDish`
- `deleteDish`
- `placeOrder`
- `getOrders`
- `updateOrderStatus`
- `adjustStarCoins`
- `initCategories`
- `saveCategory`

### 7.3 图片上传

`POST /api/uploads/images`

- 请求方式：`multipart/form-data`
- 字段：`file`
- 后端将图片写入 MinIO，并返回公开访问 URL

---

## 8. 关键数据流

### 8.1 启动与登录流程

```text
小程序启动
→ wx.login
→ /api/auth/login
→ 后端调用 jscode2session 获取 openid
→ 签发 JWT
→ 调用 getUserInfo 获取/创建用户
```

### 8.2 下单流程

```text
点菜端选菜
→ 加入本地购物车
→ 确认下单
→ POST /api/functions/placeOrder
→ 后端重新查菜品验价
→ 锁定用户余额并扣减星星币
→ 创建订单
→ 返回订单ID
→ 订单详情页轮询获取状态
```

### 8.3 厨师接单流程

```text
厨师端进入订单页
→ 轮询 placed 订单
→ 点击接单
→ updateOrderStatus(accepted)
→ 点击开始制作
→ updateOrderStatus(cooking)
→ 点击完成
→ updateOrderStatus(done)
→ 点菜端轮询详情页看到状态变化
```

### 8.4 图片上传流程

```text
小程序选择图片
→ 本地压缩
→ POST /api/uploads/images
→ 后端上传至 MinIO
→ 返回图片 URL
→ 保存菜品时写入 dishes.cover_image / steps.image
```

---

## 9. 安全与一致性设计

- **服务端验价**：`placeOrder` 不信任客户端价格，后端重新查询菜品计算
- **状态机校验**：`updateOrderStatus` 校验订单状态转换是否合法
- **事务保证**：下单与取消订单使用数据库事务保证余额和订单一致
- **软删除**：菜品采用 `is_deleted` 逻辑删除
- **JWT 鉴权**：业务接口统一通过 Bearer Token 识别用户
- **微信身份来源**：正式环境通过 `code2session` 获取可信 openid
- **图片隔离**：图片由 MinIO 单独管理，业务表仅保存 URL

---

## 10. 部署建议

### 10.1 本地开发

- 用 `docker compose up -d` 启动 MySQL 和 MinIO
- `backend/.env` 配置数据库、对象存储和微信参数
- `go run ./cmd/api` 启动后端
- 小程序 `secret.config.js` 指向后端地址

### 10.2 生产环境

- Go 服务部署到云主机 / 容器平台
- MySQL 使用托管或独立实例
- MinIO 可自建，也可替换为兼容 S3 的对象存储
- `MINIO_PUBLIC_BASE_URL` 配置为对外可访问域名
- 合法 request 域名、下载域名在微信小程序后台配置

---

## 11. 迁移说明

- `cloudfunctions/` 保留作为旧逻辑参考，不再是运行时依赖
- `miniprogram/utils/cloud.js` 已从“云函数调用层”改为“HTTP 兼容层”
- `watchOrder` / `watchNewOrders` 已改为轮询实现
- `upload.js` 已从 GitCode 图床切换为后端 + MinIO
