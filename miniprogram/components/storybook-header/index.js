const { getNavigationLayout } = require('../../utils/navigation')

Component({
  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    scene: { type: String, value: 'menu' },
    showSearch: { type: Boolean, value: false },
    compact: { type: Boolean, value: false }
  },
  data: { navigationHeight: 64, navigationContentTop: 26, navigationContentHeight: 32, navigationRight: 100 },
  lifetimes: {
    attached() {
      try { this.setData(getNavigationLayout()) } catch (e) {}
    }
  },
  methods: {
    goHome() { this.triggerEvent('hometap') },
    search() { this.triggerEvent('searchtap') }
  }
})
