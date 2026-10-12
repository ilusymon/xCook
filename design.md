# 星厨房 情侣点餐微信小程序 — 技术设计文档

## 1. 项目概述

星厨房是一款面向情侣的私人点餐微信小程序。一方在「点菜端」浏览菜单、选择口味并提交完整愿望单；另一方在「厨师端」接下愿望并逐道制作。产品只保留愿望单概念，不包含支付或虚拟币机制。

### 1.1 核心目标
- 让情侣间的做饭点餐更有仪式感和趣味性
- 厨师可以完整管理菜品分类、菜品、食材、步骤、视频
- 点菜人可以方便浏览、选择口味、提交并追踪愿望单
- 将原云开发方案替换为可自部署的 `Go + MySQL + MinIO` 架构

---

## 2. 技术选型

| 层级 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生 MINA 框架 |
| UI 组件 | 原生组件、公共底部导航与全局主题 |
| 后端 | Go 1.25 + Gin |
| 数据库 | MySQL 8 + GORM |
| 数据库迁移 | golang-migrate |
| 图片存储 | MinIO |
| 鉴权 | `wx.login` + 后端 `code2session` + JWT |
| 实时通信 | 小程序轮询 |

### 2.1 架构说明

- 小程序不再依赖 `wx.cloud`
- 原云开发接口能力统一由 Go 后端暴露为 HTTP API
- 业务数据从云数据库迁移到 MySQL
- 表结构通过 `golang-migrate` 的版本化 SQL 管理
- 菜品封面图、步骤图上传至 MinIO
- 原数据库 `watch` 实时监听改为前端定时轮询

---

## 3. 项目结构

```text
xCook/
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
│   │   ├── migrate/               # golang-migrate 执行器与 SQL 文件
│   │   ├── model/                 # GORM 模型
│   │   ├── service/               # 业务逻辑
│   │   ├── storage/               # MinIO 上传
│   │   └── wechat/                # 微信 code2session
│   ├── .env.example
│   └── go.mod
│
├── miniprogram/
│   ├── project.config.json       # 微信开发者工具项目配置
│   ├── package.json              # 小程序前端依赖
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
```

---

## 4. 数据库设计

MySQL 中保留与原业务一致的数据结构，但将数组/对象字段改为 JSON 列存储。
数据库表由 `golang-migrate` 维护，而不是运行时自动推断。

### 4.1 users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键，等于 openid |
| openid | varchar(64) | 微信 openid |
| nick_name | varchar(128) | 昵称 |
| avatar_url | varchar(1024) | 头像 |
| role | varchar(32) | `orderer` / `chef` / `both` |
| star_coins | bigint | 兼容旧数据的遗留字段，业务不再使用 |
| coin_log | json | 兼容旧数据的遗留字段，业务不再使用 |
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
| price | bigint | 兼容旧数据的遗留字段，业务不再使用 |
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

### 4.4 愿望单（兼容存储表 `orders`）

产品层只使用“愿望单”。数据库沿用 `orders` 表和 `order_number` 字段，避免破坏已有愿望单数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(64) | 主键 |
| order_number | varchar(32) | 愿望单编号（历史字段名） |
| user_id | varchar(64) | 许愿人 openid |
| status | varchar(32) | `placed` / `accepted` / `cooking` / `done` / `cancelled` |
| items | json | 菜品明细 |
| total_price | bigint | 兼容旧数据的遗留字段，新愿望单固定为 0 |
| total_calories | bigint | 总热量 |
| note | text | 备注 |
| status_history | json | 状态流转历史 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 4.5 JSON 结构

`optionGroups`、`materials`、`steps`、`items`、`statusHistory` 保持与原设计一致，便于前端平滑迁移。

---

## 5. 页面设计

页面信息架构与原设计保持一致，不因后端迁移而调整。

### 5.1 点菜端
- 首页：角色选择
- 菜单页：左分类右菜品、购物车汇总
- 菜品详情页：封面、描述、难度、选项选择
- 购物车页：增减、删除、汇总
- 结算页：确认菜品、数量、口味选项和备注，提交愿望单
- 愿望单页：统一展示全部 / 进行中 / 已完成愿望
- 愿望单详情页：状态进度、菜品明细、备注、总热量、取消愿望

### 5.2 厨师端
- 厨房首页：待处理数、菜品总数、快捷入口
- 分类管理：增删改排序、启停
- 菜品管理：上下架、编辑、删除
- 菜品编辑：图片、基本信息、选项、材料、步骤、视频
- 烹饪指引：步骤时间线、材料勾选
- 愿望单管理：接下愿望、按菜品推进制作步骤、完成

---

## 6. UI 设计规范

点菜端与厨师端采用统一的卡通绘本视觉，以 design-assets/cartoon-kitchen/concept.png 为方向：

- 主色：珊瑚橙 `#FF9278`；辅色：奶油黄 `#FFE293`、浅蓝 `#BDDCED`
- 页面背景：暖奶油 `#FFF9EA`；纸张与卡片：`#FFFCF3`
- 文字与主要轮廓：巧克力 `#593B30`；次要文字：`#8A7466`
- 圆润手写标题、系统正文、细棕描边、非对称小圆角与少量实色投影
- 菜单采用插画菜品卡与黄色餐单栏，愿望单采用夹子便签与心形进度，厨房采用真实待办与工具插画
- 小程序原生文本、筛选、数量和状态组件承载交互，插画不包含按钮或业务文字
- 公共场景头部、菜品图片回退、工具图集和底部导航供主页面复用
- 标题字体子集与完整 OFL 许可随包分发，动态文本的未收录字符回退系统字体

素材与提示词见 [卡通设计说明](design-assets/cartoon-kitchen/README.md)，运行验收边界见 [design-qa.md](design-qa.md)。

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
    "role": "both"
  }
}
```

### 7.2 RESTful 接口

后端按资源拆分为 RESTful 路由：

- `GET /api/users/me`
- `GET /api/menu`
- `GET /api/dishes/:id`
- `POST /api/dishes`
- `PUT /api/dishes/:id`
- `DELETE /api/dishes/:id`
- `GET /api/wishlists`
- `GET /api/wishlists/:id`
- `POST /api/wishlists`
- `PATCH /api/wishlists/:id/status`
- `PATCH /api/wishlists/:id/items/:itemIndex`

旧 `/api/orders` 路由保留为兼容别名，不作为新页面入口。
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`

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

### 8.2 提交愿望流程

```text
点菜端选菜
→ 加入本地购物车
→ 确认愿望
→ POST /api/wishlists
→ 后端重新校验菜品和数量
→ 创建一份包含全部菜品、数量、口味选项和备注的愿望单
→ 返回愿望单ID
→ 愿望单详情页轮询获取状态
```

### 8.3 厨师接下愿望流程

```text
厨师端进入愿望单页
→ 轮询 placed 愿望单
→ 点击接下愿望
→ updateOrderStatus(accepted)
→ 进入愿望详情，逐道打开制作指引
→ updateWishlistDishProgress(start / next)
→ 后端按每道菜的步骤更新进度
→ 全部菜品完成后，整体状态自动变为 done
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

- **服务端校验**：`placeOrder` 不信任客户端菜品信息，后端重新查询菜品并校验可用状态
- **状态机校验**：愿望单整体状态和每道菜的制作步骤都在服务端校验
- **事务保证**：提交、取消和更新制作进度使用数据库事务保证愿望单一致
- **软删除**：菜品采用 `is_deleted` 逻辑删除
- **JWT 鉴权**：业务接口统一通过 Bearer Token 识别用户
- **微信身份来源**：正式环境通过 `code2session` 获取可信 openid
- **图片隔离**：图片由 MinIO 单独管理，业务表仅保存 URL

---

## 10. 部署建议

### 10.1 本地开发

- 用 `docker compose up -d` 启动 MySQL 和 MinIO
- `backend/.env` 配置数据库、对象存储和微信参数
- `go run ./cmd/api` 启动后端，启动时自动执行迁移
- 小程序 `secret.config.js` 指向后端地址

### 10.2 生产环境

- Go 服务部署到云主机 / 容器平台
- MySQL 使用托管或独立实例
- MinIO 可自建，也可替换为兼容 S3 的对象存储
- `MINIO_PUBLIC_BASE_URL` 配置为对外可访问域名
- 合法 request 域名、下载域名在微信小程序后台配置

---

## 11. 迁移说明

- `miniprogram/utils/cloud.js` 已从“云能力调用层”改为“HTTP 兼容层”
- `watchOrder` / `watchNewOrders` 已改为轮询实现
- `upload.js` 已从 GitCode 图床切换为后端 + MinIO
- 数据库建表与升级已从 `AutoMigrate` 切换为 `golang-migrate`
