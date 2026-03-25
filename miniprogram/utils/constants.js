/**
 * 常量定义
 */

// 订单状态
const ORDER_STATUS = {
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  COOKING: 'cooking',
  DONE: 'done',
  CANCELLED: 'cancelled'
}

// 订单状态文本
const ORDER_STATUS_TEXT = {
  placed: '已下单',
  accepted: '已接单',
  cooking: '制作中',
  done: '已完成',
  cancelled: '已取消'
}

// 订单状态颜色
const ORDER_STATUS_COLOR = {
  placed: '#FF9F43',
  accepted: '#54A0FF',
  cooking: '#FF6B6B',
  done: '#5FD068',
  cancelled: '#B0B0B0'
}

// 订单状态步骤序号（用于 steps 组件）
const ORDER_STATUS_STEP = {
  placed: 0,
  accepted: 1,
  cooking: 2,
  done: 3,
  cancelled: -1
}

// 选项类型
const OPTION_TYPE = {
  SINGLE: 'single',
  MULTI: 'multi'
}

// 难度等级
const DIFFICULTY = {
  1: '简单',
  2: '中等',
  3: '困难'
}

const DIFFICULTY_COLOR = {
  1: '#5FD068',
  2: '#FFC048',
  3: '#FF6B6B'
}

// 角色
const ROLE = {
  ORDERER: 'orderer',
  CHEF: 'chef',
  BOTH: 'both'
}

// 默认分类列表
const DEFAULT_CATEGORIES = [
  { name: '荤菜', icon: 'meat', sortOrder: 1 },
  { name: '素菜', icon: 'vegetable', sortOrder: 2 },
  { name: '汤品', icon: 'soup', sortOrder: 3 },
  { name: '主食', icon: 'staple', sortOrder: 4 },
  { name: '甜品', icon: 'dessert', sortOrder: 5 },
  { name: '饮品', icon: 'drink', sortOrder: 6 }
]

// 主题色
const THEME = {
  primary: '#FF6B81',
  primaryLight: '#FFB8C6',
  primaryDark: '#E84660',
  secondary: '#FFC048',
  bg: '#FFF5F5',
  text: '#4A3333',
  textSecondary: '#9B8888',
  border: '#FFE4E4'
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_TEXT,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_STEP,
  OPTION_TYPE,
  DIFFICULTY,
  DIFFICULTY_COLOR,
  ROLE,
  DEFAULT_CATEGORIES,
  THEME
}
