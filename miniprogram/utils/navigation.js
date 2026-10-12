function getNavigationLayout() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
  const statusBarHeight = info.statusBarHeight || 20
  const navigationContentTop = capsule && capsule.top ? capsule.top : statusBarHeight + 6
  const navigationContentHeight = capsule && capsule.height ? capsule.height : 32
  return {
    statusBarHeight,
    navigationContentTop,
    navigationContentHeight,
    navigationHeight: navigationContentTop + navigationContentHeight + 6,
    navigationRight: capsule ? info.windowWidth - capsule.left + 8 : 8
  }
}

module.exports = { getNavigationLayout }
