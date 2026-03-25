# xCook 情侣点餐微信小程序 — 技术设计文档

## 1. 项目概述

xCook 是一款面向情侣的私人点餐微信小程序。一方在「点菜端」浏览菜单、选择口味、下单；另一方在「厨师端」管理菜品、接单制作。使用虚拟「星星币」作为支付方式，不接入真实支付。

### 1.1 核心目标
- 让情侣间的做饭点餐变得有仪式感和趣味性
- 厨师可以完整管理菜品的食材、步骤、视频
- 点菜人可以方便地浏览、选择口味偏好、追踪订单

---

## 2. 技术选型

| 层级 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生 MINA 框架 |
| UI 组件库 | iView Weapp |
| 后端 | 微信云开发（CloudBase） |
| 数据库 | 云开发数据库（MongoDB-like） |
| 文件存储 | 云开发存储 |
| 实时通信 | 数据库实时推送（watch） |

---

## 3. 项目结构

```
xCook/
├── project.config.json          # 小程序项目配置
├── package.json                 # npm 依赖（iview-weapp）
├── design.md                    # 本设计文档
├── README.md                    # 项目说明
│
├── miniprogram/
│   ├── app.js                   # 全局逻辑（云初始化、购物车管理）
│   ├── app.json                 # 全局配置（页面路由、tabBar）
│   ├── app.wxss                 # 全局样式（CSS 变量、通用类）
│   ├── sitemap.json
│   │
│   ├── images/                  # 图标资源
│   │   ├── tab-home.png / tab-home-active.png
│   │   ├── tab-cart.png / tab-cart-active.png
│   │   ├── tab-order.png / tab-order-active.png
│   │   ├── tab-chef.png / tab-chef-active.png
│   │   └── star-coin.png
│   │
│   ├── utils/
│   │   ├── cloud.js             # 云函数调用封装
│   │   ├── auth.js              # 用户角色与权限
│   │   ├── constants.js         # 常量定义
│   │   └── format.js            # 格式化工具
│   │
│   ├── components/
│   │   ├── dish-card/           # 菜品卡片
│   │   ├── cart-bar/            # 悬浮购物车栏
│   │   ├── option-picker/       # 口味选项选择器
│   │   ├── star-coin-badge/     # 星星币余额徽章
│   │   ├── order-status-tag/    # 订单状态标签
│   │   ├── step-card/           # 制作步骤卡片
│   │   └── material-list/       # 食材清单
│   │
│   └── pages/
│       ├── index/               # 首页（角色选择 + 情侣配对）
│       │
│       ├── order/               # ── 点菜端 ──
│       │   ├── menu/            # 菜单浏览（左分类 + 右列表）
│       │   ├── dish-detail/     # 菜品详情 + 选项选择
│       │   ├── cart/            # 购物车
│       │   ├── checkout/        # 确认下单 + 星星币支付
│       │   ├── order-list/      # 订单列表
│       │   └── order-detail/    # 订单详情 + 状态跟踪
│       │
│       └── chef/                # ── 厨师端 ──
│           ├── dashboard/       # 厨房首页（统计 + 快捷入口）
│           ├── dish-manage/     # 菜品管理列表
│           ├── dish-edit/       # 菜品编辑（选项组/食材/步骤/视频）
│           ├── cook-view/       # 沉浸式烹饪指引
│           └── order-manage/    # 订单管理（接单/制作/完成）
│
└── cloudfunctions/
    ├── getUserInfo/             # 获取/创建用户 + 配对
    ├── getMenu/                 # 获取菜单（分类+菜品）
    ├── getDishDetail/           # 获取菜品详情
    ├── saveDish/                # 新建/更新菜品
    ├── deleteDish/              # 软删除菜品
    ├── placeOrder/              # 下单（服务端验价+扣币）
    ├── getOrders/               # 查询订单列表/详情
    ├── updateOrderStatus/       # 更新订单状态
    ├── adjustStarCoins/         # 调整星星币余额
    └── initCategories/          # 初始化默认分类
```

---

## 4. 数据库设计

### 4.1 users 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 等于 openid |
| openid | string | 微信 openid |
| nickName | string | 昵称 |
| avatarUrl | string | 头像 |
| role | string | `orderer` / `chef` / `both` |
| starCoins | number | 星星币余额（初始赠送 100） |
| coinLog | array | 星星币变动记录 |
| coupleId | string | 关联 couple 集合的 _id |
| coupleCode | string | 配对码（openid 后6位大写） |
| createdAt | date | 注册时间 |

### 4.2 couple 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| user1 | string | openid |
| user2 | string | openid |
| createdAt | date | 配对时间 |

### 4.3 categories 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| name | string | 分类名（荤菜/素菜/汤品/主食/甜品/饮品） |
| icon | string | 图标标识 |
| sortOrder | number | 排序序号 |
| isActive | boolean | 是否启用 |

### 4.4 dishes 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| name | string | 菜品名称 |
| description | string | 简短描述 |
| coverImage | string | 封面图（cloud fileID） |
| categoryId | string | 所属分类 ID |
| price | number | 星星币价格 |
| calories | number | 卡路里（kcal） |
| preparationTime | number | 制作时间（分钟） |
| difficulty | number | 难度（1简单 2中等 3困难） |
| isAvailable | boolean | 是否上架 |
| isDeleted | boolean | 是否已删除（软删除） |
| optionGroups | array | 选项组 |
| materials | array | 制作材料 |
| steps | array | 制作步骤 |
| videoUrl | string | 制作视频链接 |
| createdBy | string | 创建者 openid |
| createdAt | date | 创建时间 |

#### optionGroups 结构
```json
[
  {
    "groupName": "辣度",
    "type": "single",
    "required": true,
    "options": [
      { "label": "不辣", "value": "不辣", "extraPrice": 0 },
      { "label": "微辣", "value": "微辣", "extraPrice": 0 },
      { "label": "中辣", "value": "中辣", "extraPrice": 0 },
      { "label": "特辣", "value": "特辣", "extraPrice": 2 }
    ]
  },
  {
    "groupName": "加料",
    "type": "multi",
    "required": false,
    "options": [
      { "label": "加葱", "value": "加葱", "extraPrice": 0 },
      { "label": "加蒜", "value": "加蒜", "extraPrice": 0 },
      { "label": "加蛋", "value": "加蛋", "extraPrice": 3 }
    ]
  }
]
```

#### materials 结构
```json
[
  { "name": "鸡胸肉", "amount": "200g", "note": "去皮" },
  { "name": "青椒", "amount": "2个", "note": "" }
]
```

#### steps 结构
```json
[
  {
    "stepNumber": 1,
    "description": "鸡胸肉切丁，加料酒、盐腌制15分钟",
    "image": "cloud://xxx",
    "duration": 15
  }
]
```

### 4.5 orders 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| orderNumber | string | 订单号（XC+日期+随机码） |
| userId | string | 下单人 openid |
| status | string | `placed` / `accepted` / `cooking` / `done` / `cancelled` |
| items | array | 订单菜品明细 |
| totalPrice | number | 总价（星星币） |
| totalCalories | number | 总热量 |
| note | string | 备注 |
| statusHistory | array | 状态变更历史 |
| createdAt | date | 创建时间 |

#### 订单状态流转
```
placed → accepted → cooking → done
  ↓         ↓
cancelled  cancelled
```

---

## 5. 页面设计

### 5.1 点菜端

#### 首页 (index)
- 角色选择入口：「我要点菜」/「我要做菜」
- 情侣配对：输入配对码或展示自己的配对码
- 星星币余额显示

#### 菜单页 (order/menu)
- 左侧分类侧边栏，右侧菜品列表
- 菜品卡片展示封面图、名称、卡路里、价格、快速添加按钮
- 底部悬浮购物车栏（数量、总价、总卡路里）

#### 菜品详情页 (order/dish-detail)
- 大图封面 + 基本信息（名称、描述、卡路里、制作时间、难度）
- 口味选项选择器（单选/多选，支持加价）
- 数量调节
- 底部合计 + 加入购物车按钮

#### 购物车页 (order/cart)
- 购物车列表（封面、名称、已选选项标签、价格、数量调节）
- 删除 / 清空购物车
- 底部结算栏

#### 下单确认页 (order/checkout)
- 订单摘要
- 备注输入
- 余额对比（余额不足提醒）
- 星星币支付按钮

#### 订单列表页 (order/order-list)
- 全部 / 进行中 / 已完成 标签筛选
- 订单卡片（单号、状态标签、菜品摘要、时间、价格）

#### 订单详情页 (order/order-detail)
- 状态步骤条（下单→接单→制作→完成）
- 实时状态更新（数据库 watch）
- 菜品明细 + 备注 + 合计
- 可取消（仅 placed 状态）

### 5.2 厨师端

#### 厨房首页 (chef/dashboard)
- 问候区域
- 新订单提醒横幅
- 统计卡片（待处理/今日订单/菜品总数）
- 快捷操作：管理菜品、新增菜品、订单管理

#### 菜品管理 (chef/dish-manage)
- 按分类分组展示菜品
- 每道菜支持：上下架开关、编辑、查看做法、删除
- 浮动添加按钮

#### 菜品编辑 (chef/dish-edit)
- 封面图上传
- 基本信息表单（名称、描述、价格、卡路里、时间、难度、分类）
- 选项组管理（动态增删选项组和选项，设置单选/多选、必选/可选、加价）
- 制作材料管理（动态增删，名称+用量+备注）
- 制作步骤管理（动态增删，描述+图片+时长，支持拖拽排序）
- 制作视频链接
- 保存按钮（含图片上传到云存储）

#### 烹饪指引 (chef/cook-view)
- 菜品封面头部
- 食材清单（可交互式勾选）
- 步骤时间线（当前步骤高亮，已完步骤标记）
- 底部导航（上一步/看视频/下一步）

#### 订单管理 (chef/order-manage)
- 新订单 / 制作中 / 已完成 标签筛选
- 新订单实时推送（数据库 watch）
- 操作按钮：接单 → 开始制作 → 完成

---

## 6. UI 设计规范

### 6.1 色彩体系

| 角色 | 色值 | 用途 |
|------|------|------|
| 主色 | `#FF6B81` | 按钮、强调、品牌色 |
| 主色浅 | `#FFB8C6` | 选中态背景 |
| 主色深 | `#E84660` | 按钮按下态 |
| 辅色（金） | `#FFC048` | 星星币、价格 |
| 背景色 | `#FFF5F5` | 页面底色 |
| 卡片色 | `#FFFFFF` | 卡片背景 |
| 文字色 | `#4A3333` | 主文字 |
| 次要文字 | `#9B8888` | 辅助说明 |
| 成功色 | `#5FD068` | 完成状态 |
| 警告色 | `#FF9F43` | 卡路里标签 |
| 分割线 | `#FFE4E4` | 边框、分割 |

### 6.2 圆角规范

| 元素 | 圆角 |
|------|------|
| 页面卡片 | 24rpx |
| 按钮（胶囊） | 40rpx |
| 图片 | 20rpx |
| 标签 | 16rpx |
| 输入框 | 16rpx |
| FAB 按钮 | 50% |

### 6.3 阴影
- 卡片：`0 4rpx 16rpx rgba(255, 107, 129, 0.08)`
- 按钮：`0 6rpx 20rpx rgba(255, 107, 129, 0.3)`
- 底部栏：`0 -4rpx 20rpx rgba(255, 107, 129, 0.12)`

### 6.4 动效
- 按钮按下：`scale(0.97)` + 色彩加深
- 列表项出现：`fadeIn 0.3s ease`
- 购物车添加：`bounce 0.3s`

---

## 7. 云函数设计

### 7.1 getUserInfo
- 获取/自动创建用户记录
- 新用户赠送 100 星星币
- 支持配对操作（验证配对码、创建 couple 记录）

### 7.2 getMenu
- 返回所有启用分类 + 按分类分组的可用菜品

### 7.3 getDishDetail
- 根据 dishId 返回完整菜品数据

### 7.4 saveDish
- 有 `_id` 时更新，无 `_id` 时新建
- 自动设置 `createdBy`、时间戳

### 7.5 deleteDish
- 软删除（`isDeleted: true`）

### 7.6 placeOrder
- **服务端验价**：重新查询菜品价格计算，不信任客户端
- 验证菜品可用性
- 验证星星币余额
- 原子扣减星星币（`_.inc(-totalPrice)`）
- 创建订单记录

### 7.7 getOrders
- 支持按角色、状态、分页查询
- 支持查询单个订单详情

### 7.8 updateOrderStatus
- 验证状态转换合法性
- 取消订单时自动退还星星币
- 记录状态变更历史

### 7.9 adjustStarCoins
- 手动调整星星币（伴侣互赠等场景）

### 7.10 initCategories
- 初始化默认 6 个菜品分类（幂等操作）

---

## 8. 关键数据流

### 8.1 下单流程
```
点菜端选菜 → 加入本地购物车 → 确认下单
→ 调用 placeOrder 云函数
→ 服务端验价 → 检查余额 → 原子扣币 → 创建订单
→ 返回订单ID → 跳转订单详情
→ 开启 watch 实时监听状态变化
```

### 8.2 厨师接单流程
```
厨师端 watch 监听新订单
→ 订单列表实时更新
→ 点击「接单」→ updateOrderStatus(accepted)
→ 点击「开始制作」→ updateOrderStatus(cooking)
→ 可查看菜品做法（cook-view 页面）
→ 点击「完成」→ updateOrderStatus(done)
→ 点菜端实时收到状态更新
```

---

## 9. 安全考量

- **服务端验价**：placeOrder 不信任客户端传入的价格，服务端重新查询计算
- **状态机校验**：updateOrderStatus 验证状态转换的合法性
- **原子操作**：星星币扣减使用 `_.inc()` 保证原子性
- **软删除**：菜品删除为逻辑删除，保留历史订单引用完整性
- **openid 鉴权**：云函数通过 `cloud.getWXContext()` 获取可信 openid
