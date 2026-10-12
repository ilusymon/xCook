const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const manifest = require('../app.json')
const pages = [...manifest.pages, ...manifest.subpackages.flatMap(pkg => pkg.pages.map(page => `${pkg.root}/${page}`))]
const clone = value => JSON.parse(JSON.stringify(value))
const flush = () => new Promise(resolve => setImmediate(resolve))

function load(file, { app, modules = {}, wx: wxOverrides = {}, timers = [] } = {}) {
  let definition
  const wx = {
    getStorageSync: () => '', setStorageSync() {}, hideTabBar() {},
    showToast() {}, showLoading() {}, hideLoading() {}, showModal() {},
    navigateTo() {}, navigateBack() {}, redirectTo() {}, switchTab() {},
    setNavigationBarTitle() {}, ...wxOverrides
  }
  const sandbox = {
    App: value => { definition = value }, Page: value => { definition = value }, Component: value => { definition = value },
    getApp: () => app, wx, console: { log() {}, warn() {}, error() {} },
    module: { exports: {} },
    setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout() {},
    require: name => Object.prototype.hasOwnProperty.call(modules, name) ? modules[name]
      : name.endsWith('/cloud') ? {} : require(path.resolve(root, path.dirname(file), name))
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file })
  if (!definition) return sandbox.module.exports
  const instance = { ...definition, ...definition.methods, data: clone(definition.data || {}), globalData: clone(definition.globalData || {}) }
  instance.createSelectorQuery = () => ({
    select() { return this }, selectAll() { return this },
    boundingClientRect() { return this }, scrollOffset() { return this },
    exec(callback) { callback([]) }
  })
  for (const [key, property] of Object.entries(definition.properties || {})) instance.data[key] = clone(property.value)
  instance.setData = (patch, callback) => {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
      let target = instance.data
      for (const part of parts.slice(0, -1)) target = target[part]
      target[parts.at(-1)] = value
    }
    if (callback) callback()
  }
  return instance
}

const event = dataset => ({ currentTarget: { dataset } })

test('image upload sends the original file and uses the compressed image for display', async () => {
  const uploaded = []
  const upload = load('utils/upload.js', { modules: {
    './api': { uploadFile: async filePath => {
      uploaded.push(filePath)
      return { path: 'images/photo.jpg', originalPath: 'originals/photo.png' }
    } },
    './media': { resolveMediaUrl: path => `https://images.example/${path}` }
  }, wx: { compressImage: () => assert.fail('original must not be compressed before upload') } })
  assert.equal(await upload.uploadImage('wxfile://photo.png'), 'https://images.example/images/photo.jpg')
  assert.deepEqual(uploaded, ['wxfile://photo.png'])
  assert.equal(await upload.uploadImage('https://images.example/images/saved.jpg'), 'https://images.example/images/saved.jpg')
  assert.equal(uploaded.length, 1)

  const selected = []
  const editor = load('package-chef/pages/dish-edit/index.js', { wx: { chooseMedia: options => selected.push(options) } })
  editor.chooseCover()
  editor.chooseStepImage(event({ idx: 0 }))
  assert.deepEqual(selected.map(options => Array.from(options.sizeType)), [['original'], ['original']])
})

test('all registered pages have balanced templates, callable events and valid routes', () => {
  for (const page of pages) {
    const instance = load(`${page}.js`)
    const markup = fs.readFileSync(path.join(root, `${page}.wxml`), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    assert.ok(!/\.indexOf\(/.test(markup), `${page}: WXML cannot call array methods`)
    const stack = []
    for (const match of markup.matchAll(/<\/?([\w-]+)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
      if (match[0].startsWith('</')) assert.equal(stack.pop(), match[1], `${page}: mismatched ${match[1]}`)
      else if (!match[0].endsWith('/>')) stack.push(match[1])
    }
    assert.deepEqual(stack, [], `${page}: unclosed tags`)
    for (const match of markup.matchAll(/\b(?:bind|catch):?[\w]+="([^"]+)"/g)) {
      assert.equal(typeof instance[match[1]], 'function', `${page}: missing ${match[1]}`)
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, `${page}.json`), 'utf8'))
    for (const [name, component] of Object.entries(config.usingComponents || {})) {
      const componentPath = component.startsWith('/') ? component.slice(1) : path.join(path.dirname(page), component)
      for (const extension of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, `${componentPath}.${extension}`)), `${page}: missing ${name}.${extension}`)
    }
    for (const match of fs.readFileSync(path.join(root, `${page}.js`), 'utf8').matchAll(/\/(?:pages|package-[a-z]+)\/[\w/-]+\/index/g)) {
      assert.ok(pages.includes(match[0].slice(1)), `${page}: unregistered route ${match[0]}`)
    }
    for (const match of markup.matchAll(/src="(\/images\/[^"{]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])), `${page}: missing image ${match[1]}`)
  }
})

test('menu category navigation jumps through the full list and search keeps the cart', async () => {
  const app = load('app.js')
  app.addToCart({ dishId: 1, quantity: 2, selectedOptions: {} })
  const response = { categories: [{ _id: 1, name: '家常菜' }, { _id: 2, name: '汤' }], dishes: {
    1: [{ _id: 1, categoryId: 1, name: '番茄牛腩' }], 2: [{ _id: 2, categoryId: 2, name: '玉米排骨汤' }]
  } }
  const menu = load('pages/order/menu/index.js', { app, modules: { '../../../utils/cloud': { getMenu: () => Promise.resolve(response) } } })
  menu.onShow()
  await flush()
  assert.equal(menu.data.dishSections.length, 2)
  menu.onCategoryTap(event({ index: '1' }))
  assert.equal(menu.data.dishSections.length, 2)
  assert.equal(menu.data.dishScrollTo, 'dish-section-2')
  assert.equal(menu.data.categoryScrollTo, 'category-2')
  menu.onSearchInput({ detail: { value: '牛腩' } })
  assert.equal(menu.data.dishSections.length, 1)
  assert.equal(menu.data.dishScrollTo, 'dish-list-top')
  assert.equal(menu.data.dishSections[0].dishes[0].name, '番茄牛腩')
  menu.onCategoryTap(event({ index: '0' }))
  response.categories.reverse()
  menu.loadMenuData()
  await flush()
  assert.equal(menu.data.currentCategory, 1)
  assert.equal(app.globalData.cart[0].quantity, 2)
  menu.data.dishScrollTo = ''
  menu.refreshCart()
  assert.equal(menu.data.dishScrollTo, '')
})

test('scrolling focuses visible categories, reaches the last short section and respects category jumps', () => {
  const toasts = []
  const menu = load('pages/order/menu/index.js', { wx: { showToast: value => toasts.push(value.title) } })
  menu.data.categories = [{ _id: '1' }, { _id: '2' }, { _id: '3' }, { _id: '4' }]
  menu.data.dishSections = [{ categoryId: '1' }, { categoryId: '2' }, { categoryId: '3' }]
  menu.createSelectorQuery = () => ({
    select() { return this }, selectAll() { return this },
    boundingClientRect() { return this }, scrollOffset() { return this },
    exec(callback) { callback([{ top: 100, height: 200 }, { scrollTop: 50, scrollHeight: 480 },
      [{ top: 50 }, { top: 260 }, { top: 440 }]]) }
  })
  menu.measureDishSections()
  menu.onDishScroll({ detail: { scrollTop: 215, scrollHeight: 480 } })
  assert.equal(menu.data.currentCategory, 1)
  assert.equal(menu.data.categoryScrollTo, 'category-2')
  menu.onDishScroll({ detail: { scrollTop: 280, scrollHeight: 480 } })
  assert.equal(menu.data.currentCategory, 2)
  menu.onDishScroll({ detail: { scrollTop: 0, scrollHeight: 480 } })
  assert.equal(menu.data.currentCategory, 0)
  menu.onCategoryTap(event({ index: '2' }))
  assert.equal(menu.data.dishScrollTo, 'dish-section-3')
  menu.onDishScroll({ detail: { scrollTop: 100, scrollHeight: 480 } })
  assert.equal(menu.data.currentCategory, 2)
  menu.onDishTouchStart()
  menu.onDishScroll({ detail: { scrollTop: 100, scrollHeight: 480 } })
  assert.equal(menu.data.currentCategory, 0)
  menu.onCategoryTap(event({ index: '3' }))
  assert.equal(menu.data.currentCategory, 0)
  assert.equal(toasts[0], '这个分类暂时没有菜品')

  let lateCallback
  menu.createSelectorQuery = () => ({
    select() { return this }, selectAll() { return this },
    boundingClientRect() { return this }, scrollOffset() { return this },
    exec(callback) { lateCallback = callback }
  })
  menu.measureDishSections()
  menu.onUnload()
  lateCallback([{ top: 0, height: 200 }, { scrollTop: 300, scrollHeight: 480 },
    [{ top: -300 }, { top: -90 }, { top: 90 }]])
  assert.equal(menu.data.currentCategory, 0)
})

test('dish artwork prefers uploaded covers and has an honest fallback for unknown dishes', () => {
  const art = load('components/dish-art/index.js')
  const observe = art.observers['coverImage, dishName']
  observe.call(art, 'https://example.test/beef.jpg', '番茄牛腩')
  assert.equal(art.data.artIndex, 0)
  art.imageError()
  assert.equal(art.data.failed, true)
  observe.call(art, '', '葱香厚蛋烧')
  assert.equal(art.data.failed, false)
  assert.equal(art.data.artIndex, 1)
  observe.call(art, '', '玉米排骨汤')
  assert.equal(art.data.artIndex, 2)
  observe.call(art, '', '土豆丝')
  assert.equal(art.data.artIndex, -1)
})

test('chef dashboard counts real states and accepts a request once before opening its progress', async () => {
  const calls = [], navigations = []
  let resolveAccept
  const dashboard = load('pages/chef/dashboard/index.js', { wx: { navigateTo: options => navigations.push(options.url) }, modules: {
    '../../../utils/cloud': {
      getWishlist: (role, status, page, pageSize) => {
        calls.push({ role, status, page, pageSize })
        return Promise.resolve({ total: { placed: 3, cooking: 2, active: 6 }[status],
          wishlists: status === 'active' ? [{ _id: 42, status: 'placed', items: [{ dishName: '炒饭' }] }] : [] })
      },
      getMenu: () => Promise.resolve({ dishes: { 1: [{}, {}], 2: [{}] } }),
      updateWishlistStatus: (id, status) => { calls.push({ id, status }); return new Promise(resolve => { resolveAccept = resolve }) }
    }
  } })
  await dashboard.loadStats()
  assert.equal(dashboard.data.pendingCount, 3)
  assert.equal(dashboard.data.cookingCount, 2)
  assert.equal(dashboard.data.dishCount, 3)
  assert.equal(dashboard.data.requests[0].previewItems[0].dishName, '炒饭')
  dashboard.openRequest(event({ index: 0 }))
  dashboard.openRequest(event({ index: 0 }))
  assert.equal(calls.filter(call => call.id === 42).length, 1)
  assert.equal(navigations.length, 0)
  resolveAccept({ success: true })
  await flush()
  assert.equal(dashboard.data.busy, false)
  assert.equal(navigations[0], '/package-order/pages/wishlist-detail/index?id=42&role=chef')
})

test('shared navigation returns from the kitchen to the highlighted profile tab', () => {
  let target
  const navigation = load('components/bottom-navigation/index.js', { app: { globalData: {} }, wx: { switchTab: options => { target = options.url } } })
  navigation.data.active = 'profile'
  navigation.navigate(event({ index: 3 }))
  assert.equal(target, '/pages/profile/index')
})

test('cart merges equivalent options and protects quantities', () => {
  const saved = []
  const app = load('app.js', { wx: { setStorageSync: (_, cart) => saved.push(clone(cart)) } })
  app.addToCart({ dishId: 1, quantity: 1, calories: 120, selectedOptions: { 加料: ['葱', '蛋'], 辣度: ['微辣'] } })
  app.addToCart({ dishId: '1', quantity: 2, calories: 120, selectedOptions: { 辣度: ['微辣'], 加料: ['蛋', '葱'] } })
  assert.equal(app.globalData.cart.length, 1)
  assert.equal(saved.at(-1)[0].quantity, 3)
  assert.deepEqual(clone(app.getCartSummary()), { totalCount: 3, totalCalories: 360 })
  assert.throws(() => app.addToCart({ dishId: 1, quantity: 100, selectedOptions: {} }))
  const id = app.globalData.cart[0].cartItemId
  app.updateCartItemQuantity(id, 100)
  assert.equal(app.globalData.cart[0].quantity, 3)
  app.updateCartItemQuantity(id, 0)
  assert.equal(app.globalData.cart.length, 0)
})

test('availability patches never clear recipe images or steps', () => {
  const media = require('../utils/media')
  assert.deepEqual(media.denormalizeDish({ _id: 4, isAvailable: false }), { _id: 4, isAvailable: false })
  const normalized = media.normalizeDish({ _id: 4, materials: null, optionGroups: null, steps: null })
  assert.deepEqual(normalized.materials, [])
  assert.deepEqual(normalized.optionGroups, [])
  assert.deepEqual(normalized.steps, [])
})

test('menu persists selection immediately and preserves flavor variants at checkout', () => {
  const app = load('app.js')
  const navigations = []
  const menu = load('pages/order/menu/index.js', { app, wx: { navigateTo: options => navigations.push(options.url) } })
  menu.data.dishes = [{ _id: '1', categoryId: '1', name: '炒饭', calories: 200, optionGroups: [], quantity: 0 },
    { _id: '2', categoryId: '1', name: '面', calories: 100, optionGroups: [{ groupName: '辣度' }], quantity: 0 }]
  menu.data.categories = [{ _id: '1', name: '主食' }]
  menu.onQuantityTap(event({ id: '1', delta: 1 }))
  assert.equal(app.globalData.cart[0].quantity, 1)
  menu.onQuantityTap(event({ id: '2', delta: 1 }))
  assert.equal(navigations.at(-1), '/package-order/pages/dish-detail/index?id=2')
  app.addToCart({ dishId: 2, dishName: '面', quantity: 1, calories: 100, selectedOptions: { 辣度: ['微辣'] } })
  app.addToCart({ dishId: 2, dishName: '面', quantity: 2, calories: 100, selectedOptions: { 辣度: ['不辣'] } })
  menu.refreshCart()
  assert.equal(menu.data.dishes[1].quantity, 3)
  menu.goCheckout()
  assert.equal(app.globalData.cart.length, 3)
  assert.deepEqual(clone(app.globalData.cart[1].selectedOptions), { 辣度: ['微辣'] })
  menu.onSearchInput({ detail: { value: '炒饭' } })
  assert.equal(menu.data.dishSections[0].dishes.length, 1)
  assert.equal(menu.data.cartSummary.totalCount, 4)
  app.globalData.searchMenu = true
  menu.loadMenuData = () => {}
  menu.onShow()
  assert.equal(menu.data.searchVisible, true)
  assert.equal(app.globalData.searchMenu, false)
})

test('option picker validates required groups and exposes renderable selected flags', () => {
  const picker = load('package-order/components/option-picker/index.js')
  picker.data.optionGroups = [{ groupName: '辣度', type: 'single', required: true, options: [{ label: '微辣', value: '微辣' }] },
    { groupName: '加料', type: 'multi', options: [{ label: '蛋', value: '蛋' }] }]
  assert.equal(picker.validate().valid, false)
  picker.onSingleSelect(event({ group: '辣度', value: '微辣' }))
  picker.onMultiSelect(event({ group: '加料', value: '蛋' }))
  assert.equal(picker.validate().valid, true)
  assert.equal(picker.data.groups[1].options[0].selected, true)
  picker.onMultiSelect(event({ group: '加料', value: '蛋' }))
  assert.equal(picker.data.groups[1].options[0].selected, false)
})

test('checkout blocks repeated submissions and retains cart on failure', async () => {
  const app = load('app.js')
  app.addToCart({ dishId: 1, dishName: '面', quantity: 2, calories: 100, selectedOptions: { 辣度: ['微辣'] } })
  let rejectRequest, calls = 0
  const checkout = load('package-order/pages/checkout/index.js', { app, modules: {
    '../../../utils/cloud': { createWishlist: () => { calls++; return new Promise((_, reject) => { rejectRequest = reject }) } }
  } })
  checkout.onShow()
  checkout.submitWishlist()
  checkout.submitWishlist()
  assert.equal(calls, 1)
  rejectRequest(new Error('菜品已下架'))
  await flush()
  assert.equal(checkout.data.submitting, false)
  assert.equal(app.globalData.cart[0].quantity, 2)
  assert.equal(checkout.data.cart[0].optionTags[0], '辣度：微辣')
})

test('wishlist polling stops on hide, restarts on show and supports older pages', () => {
  const app = { globalData: { wishlistRole: 'orderer' } }
  const calls = []
  let closed = 0
  const list = load('pages/order/wishlist/index.js', { app, modules: {
    '../../../utils/cloud': { watchWishlist: (...args) => { calls.push(args); return { close: () => closed++ } } }
  } })
  list.onShow()
  calls[0][1]([{ _id: 7, status: 'accepted', totalCalories: 972, note: '想配米饭',
    items: [{ dishName: '番茄牛腩', quantity: 2, selectedOptions: { 辣度: ['微辣'] } }]
  }], { total: 35, hasMore: true })
  assert.equal(list.data.items[0].statusText, '大厨已接下')
  assert.equal(list.data.items[0].actionText, '查看制作进度')
  assert.equal(list.data.items[0].itemSummary, '共 2 份 · 972 kcal')
  assert.equal(list.data.items[0].items[0].optionTags[0], '辣度：微辣')
  assert.deepEqual(clone(list.data.items[0].items[0].optionBadges), [{ label: '微辣', tag: '辣度：微辣' }])
  assert.equal(list.data.items[0].note, '想配米饭')
  list.loadMore()
  assert.equal(calls.at(-1)[4], 40)
  list.onHide()
  assert.equal(closed, 2)
  list.onShow()
  assert.equal(calls.length, 3)
})

test('cooking progress updates once and is read from the mutation response', async () => {
  let resolveRequest, calls = 0
  const cook = load('package-chef/pages/cook-view/index.js', { modules: {
    '../../../utils/cloud': {
      updateWishlistDishProgress: () => { calls++; return new Promise(resolve => { resolveRequest = resolve }) },
      watchWishlistDetail: () => ({ close() {} })
    }
  } })
  Object.assign(cook.data, { loading: false, wishlistMode: true, wishlistId: '1', itemIndex: 0, itemStatus: 'accepted', dish: { steps: [{ description: '炒熟' }] } })
  cook.nextStep()
  cook.nextStep()
  assert.equal(calls, 1)
  resolveRequest({ wishlist: { status: 'cooking', items: [{ status: 'cooking', currentStep: 0 }] } })
  await flush()
  assert.equal(cook.data.itemStatus, 'cooking')
  assert.equal(cook.data.busy, false)
})

test('main package stays within 2 MiB without archived artwork or tests', () => {
  let bytes = 0
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) {
        if (!['package-chef', 'package-order', 'node_modules', 'miniprogram_npm', 'tests'].includes(entry.name)) visit(file)
      } else if (!['project.private.config.json', 'secret.config.js'].includes(entry.name)) bytes += fs.statSync(file).size
    }
  }
  visit(root)
  assert.ok(bytes < 2 * 1024 * 1024, `main package is ${bytes} bytes`)
})

test('checkout success clears cart only after receiving the new wishlist', async () => {
  const app = load('app.js')
  app.addToCart({ dishId: 1, quantity: 1, selectedOptions: {} })
  let resolveRequest, target
  const checkout = load('package-order/pages/checkout/index.js', { app,
    wx: { redirectTo: options => { target = options.url } },
    modules: { '../../../utils/cloud': { createWishlist: () => new Promise(resolve => { resolveRequest = resolve }) } }
  })
  checkout.onShow()
  checkout.submitWishlist()
  assert.equal(app.globalData.cart.length, 1)
  resolveRequest({ success: true, wishlistId: 42 })
  await flush()
  assert.equal(app.globalData.cart.length, 0)
  assert.equal(target, '/package-order/pages/wishlist-detail/index?id=42')
})

test('dish editor loads categories before assigning the current category', async () => {
  let resolveMenu, detailCalls = 0
  const editor = load('package-chef/pages/dish-edit/index.js', { modules: { '../../../utils/cloud': {
    getMenu: () => new Promise(resolve => { resolveMenu = resolve }),
    getDishDetail: () => { detailCalls++; return Promise.resolve({ _id: 5, categoryId: 2, name: '炒饭' }) }
  } } })
  editor.onLoad({ id: '5' })
  assert.equal(detailCalls, 0)
  resolveMenu({ categories: [{ _id: 1, name: '荤菜' }, { _id: 2, name: '主食' }] })
  await flush()
  assert.equal(detailCalls, 1)
  assert.equal(editor.data.categoryIndex, 1)
  assert.equal(editor.data.dish.categoryId, 2)
})

test('category sorting uses one atomic request and protects repeated taps', async () => {
  const calls = []
  let resolveRequest
  const categories = load('package-chef/pages/category-manage/index.js', { modules: { '../../../utils/cloud': {
    saveCategory: payload => { calls.push(payload); return new Promise(resolve => { resolveRequest = resolve }) },
    getMenu: () => Promise.resolve({ categories: [] })
  } } })
  categories.data.categories = [{ _id: 1, sortOrder: 1 }, { _id: 2, sortOrder: 2 }]
  categories.swapSort('0', 1)
  categories.swapSort('0', 1)
  assert.deepEqual(clone(calls), [{ _id: 1, swapWith: 2 }])
  resolveRequest({ success: true })
  await flush()
  assert.equal(categories.data.saving, false)
})

test('polling reports failures, recovers unchanged data and ignores closed responses', async () => {
  const pending = [], timers = [], changes = [], errors = []
  const cloud = load('utils/cloud.js', { timers, modules: {
    './api': { request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })), POLL_INTERVAL: 5000 },
    './media': { normalizeWishlistResponse: value => value }
  } })
  const watcher = cloud.watchWishlist('', value => changes.push(value), error => errors.push(error.message))
  pending.shift().resolve({ wishlists: [], total: 0 })
  await flush()
  timers.shift()()
  pending.shift().reject(new Error('网络中断'))
  await flush()
  assert.deepEqual(errors, ['网络中断'])
  timers.shift()()
  pending.shift().resolve({ wishlists: [], total: 0 })
  await flush()
  assert.equal(changes.length, 2)
  timers.shift()()
  watcher.close()
  pending.shift().resolve({ wishlists: [{ _id: 1 }], total: 1 })
  await flush()
  assert.equal(changes.length, 2)
  assert.equal(timers.length, 0)
})
