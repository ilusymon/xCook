Component({
  properties: { kind: { type: String, value: 'dishes' } },
  data: { left: 0, top: 0 },
  observers: {
    kind(kind) {
      const positions = { dishes: [0, 0], add: [-100, 0], categories: [0, -100], wishes: [-100, -100] }
      const position = positions[kind] || positions.dishes
      this.setData({ left: position[0], top: position[1] })
    }
  }
})
