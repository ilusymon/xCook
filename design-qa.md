# Design QA

## 菜单紧凑列表与分类联动 — 2026-10-12

右侧菜品卡最低高度由 210rpx 调至 164rpx，图片改为 112rpx、说明限制一行，加号独立于文字且保留 88rpx 点击区域。右侧滚动区域底部额外留出 20rpx。左侧改为可点击文字导航，移除 button、胶囊边框与阴影，仅使用文字高亮和选中竖线。

右侧连续显示分类分组，左侧点击跳转而不再过滤分类；右侧滚动依据分组的实际位置更新左侧高亮并将分类滚入可见区域。处理末尾较短分组、点击跳转期间的滚动反馈、空分类、全菜单搜索和失效的异步测量回调。选菜刷新不主动跳回顶部。

18 项回归通过，27 个 WXML 与 31 个 WXSS 离线编译通过，主包源文件静态估算约 1.32 MiB。没有启动预览服务；真实设备滚动与长菜名视觉效果尚待确认。

## 菜单双栏布局 — 2026-10-12

按用户要求，菜单改为左侧分类导航、右侧菜品列表，两列独立滚动。缩短头图，列表使用剩余屏幕高度，底部留出餐单与导航安全区。菜品图片、字号和间距适配较窄右栏；热量与加号位于同一行，避免覆盖名称和描述。

分类和搜索变更后右侧回到顶部，选菜刷新不触发返回顶部；现有数量、口味和确认流程保留。17 项回归通过，27 个 WXML 与 31 个 WXSS 离线编译通过。未启动预览服务，双栏实际滚动与小屏效果仍待微信环境确认。

## 原生按钮尺寸与居中修复 — 2026-10-12

依据用户提供的“我的”页运行截图：资料卡变成中央窄列，昵称逐字换行，设置行挤在列表中间。已从安装的微信开发者工具默认样式中确认：v2 的原生按钮预设包含 184px 固定宽度和左右 auto 边距；仅改为 flex 卡片仍会继承这一预设。

移除 app.json 的 v2 样式预设，新增公共 button-reset.wxss，页面及四个包含按钮的隔离组件分别导入。资料卡、设置行、首页大入口和记录 / 提交按钮明确全宽与 border-box；导航、加号、返回、口味按钮保留各自的 flex 或固定尺寸。设置标签和右侧说明避免被压成单字列。头部文案改用 top / left / right 定位。

样式层叠检查读取开发者工具实际默认 CSS，复现原来 184px 的问题，并验证 14 类修复后的按钮宽度、水平边距和盒模型。17 项 npm test 通过，27 个 WXML 与 31 个 WXSS 离线编译通过；主包源文件静态估算约 1.31 MiB。没有改业务接口或数据。

未启动预览服务，暂无修复后的微信模拟器 / 真机截图，样式检查不能代替运行视觉确认。

## 按钮与便签细化 — 2026-10-12

修正参考稿与前轮实现的差异：主按钮改为白色手写字、弧形高光、珊瑚色层和不规则棕色轮廓；圆形加号采用白色圆头线条。便签移除普通圆角边框和整块投影，改为三段矢量纸沿、起伏底边与薄纸影，补齐木夹、叶枝、铅笔和粉色留言。菜品按图片、菜名 / 数量、右侧口味胶囊排布，缩短状态文字；编号与时间移至便签外。

17 项回归、27 个 WXML、30 个 WXSS 离线编译通过；补查真实愿望的数量、备注、口味和进度文案。九份 SVG 的 XML 与素材渲染检查通过，样式中的按钮底图与 SVG 源文件一致。仅核对素材渲染，未启动预览，尚未执行微信模拟器 / 真机页面像素对比。素材核对图见 design-assets/cartoon-kitchen/surface-qa.png，该图不是小程序运行截图。

## 卡通高保真落地 — 2026-10-12

参考：design-assets/cartoon-kitchen/concept.png。本次更新全部 15 个注册页面的视觉；菜单、愿望单、厨房采用参考图结构，其余页面沿用配色、标题、轮廓和插画组件。没有修改数据库、部署服务或新增情侣绑定。

| 项目 | 结果 |
| --- | --- |
| 菜单 | 横向分类与搜索组合筛选，刷新保留选中分类，上传封面优先，已选徽标与黄色餐单 |
| 愿望单 | 原生便签、口味与备注、四节点心形进度、状态筛选、角色操作和加载更多 |
| 厨房 | 待处理与制作中分别统计，真实待办，接下防重复，插画入口与待制作筛选 |
| 其余页面 | 场景头部或原生奶油导航、手写标题、轮廓卡片、统一表单与操作栏 |
| 素材与字体 | PNG 原件、旧素材完整保留；发布 JPEG、本地 WOFF2 子集、OFL 许可证 |
| 包体 | 主包源文件静态估算约 1.30 MiB，最终以微信上传打包为准 |

已通过：17 项 npm test 回归、全部 27 个 WXML 与 29 个 WXSS 离线编译、JavaScript / JSON 语法和页面引用检查。WXSS 使用 -pc 指定全部文件为编译入口。字体生成脚本的字符覆盖与大小断言通过。无后端改动，本轮未重复 Go 检查。

素材原图已查看，人物画风、标题留白、图集分格和压缩清晰度符合方向。尚无小程序运行截图，不能据此宣称逐像素一致。未启动预览或开发服务，未执行微信模拟器、真机、真实登录、MySQL 或 MinIO 联调。

微信环境需核对小屏长菜名与备注、胶囊与安全区、字体 / SVG 渲染、图片失败回退，以及选菜 → 提交 → 待制作 → 逐道完成 → 记录。下方保留前轮验收记录。

## 全页面重构验收 — 2026-10-12

范围：15 个已注册页面，公共导航、口味选择和制作组件，以及 Go 业务接口。按用户确认保留共享厨房，清理未实现的情侣绑定、提醒和虚假加油入口；旧的未注册订单页面由愿望单页面替代。保留原有未提交改动和全部业务数据结构。

| 页面 / 功能 | 本次结果 |
| --- | --- |
| 首页 | 点菜、厨房、记录、愿望清单四个可用入口 |
| 菜单 | 分类浏览、搜索、详情入口、即时持久化购物车；结算保留不同口味 |
| 菜品详情 | 必选 / 单选 / 多选口味、1～99份数量、下架状态与加载重试 |
| 购物车 / 确认愿望 | 数量、口味、热量、备注可核对；失败保留购物车，成功后清空并进入愿望详情 |
| 愿望单 | 全部 / 进行中 / 完成 / 取消筛选，加载更多；厨师与吃货视角 |
| 愿望详情 | 接下、取消、逐道制作、状态跟踪与返回入口；停止隐藏页面轮询 |
| 制作指引 | 食材勾选、步骤、视频错误反馈、无步骤菜品完成路径；防重复更新 |
| 厨房首页 | 真实统计、管理入口、加载失败重试 |
| 菜品 / 分类管理 | 编辑、上下架、停用后重新启用、删除错误反馈；分类排序单次事务 |
| 菜品编辑 | 分类与菜品按顺序加载，表单校验、图片上传、数值处理、保存防重复 |
| 记录 | 类型筛选、按日分组、日常记录提交、防重复及重试 |
| 我的 | 真实用户统计、昵称编辑、分类和厨房入口 |

视觉：共用浅蓝背景、奶油白卡片、珊瑚红按钮与暖棕正文；四个主导航页复用一个导航组件。固定操作栏与滚动内容增加安全区留白，主要按钮统一尺寸。原图移至 design-assets/originals，复用现有插画；主包源文件静态估算约 1.70 MiB，测试目录和旧 npm 产物已从打包配置排除，最终以微信打包统计为准。

已通过：

- npm test：13 个测试，模拟 wx 与 API 验证购物车、口味、提交、制作、分类排序、轮询恢复、路由和事件。
- go test ./...：全部通过，包括 ID / 口味 / 数量校验、局部更新保留菜谱、厨师查询包含停用分类的 SQL 检查。
- go vet ./...：通过。
- 微信离线编译器：24 个 WXML 模板和 25 个 WXSS 文件通过。使用已安装开发者工具中的 wcc / wcsc，没有启动预览或开发服务器。
- JavaScript / JSON 语法及页面引用检查通过。

尚未执行：微信模拟器 / 真机视觉检查、真实微信登录、MySQL 和 MinIO 联调。离线编译和模拟测试不能确认真实网络、合法域名、媒体访问或设备布局。

真机验收路径：新增分类与有口味的菜品 → 菜单搜索与选择 → 切换页面后核对购物车 → 确认备注并提交 → 厨师接下并逐道完成 → 点菜端检查状态与记录。另检查停用再启用、下架再上架、取消愿望及断网重试。

当前结果：代码与离线检查通过，真机和外部服务验收待执行。下方保留早期首页参考图检查记录，其环境判断不代表本次检查。

## Earlier homepage reference comparison

- Source visual truth: `design-assets/home-mockup-reference.png`
- Implementation screenshot: unavailable
- Intended viewport: 390 × 844 mobile
- State: home screen, first navigation item selected
- Full-view comparison evidence: blocked because the WeChat DevTools CLI is not installed in this environment and the repository does not provide a browser renderer for WXML/WXSS.
- Focused region comparison evidence: generated hero and action-card assets were opened and checked after cropping; both preserve the source art direction, copy, crop, and image quality. Runtime layout comparison remains unavailable.

## Findings

- [P2] Runtime viewport comparison is unavailable.
  - Location: `miniprogram/pages/index/index`
  - Evidence: the source mockup can be opened, but no rendered mini-program screenshot can be captured in the current environment.
  - Impact: final safe-area spacing and fixed navigation placement still need confirmation in WeChat DevTools at 390 × 844.
  - Fix: open the project in WeChat DevTools, capture the homepage at 390 × 844, and compare it with the source mockup.

## Static checks completed

- Fonts and typography: display lettering remains inside the generated image; dynamic navigation text uses platform-safe Chinese font fallbacks.
- Spacing and layout rhythm: hero and action assets retain source aspect ratios; the bottom navigation includes safe-area padding.
- Colors and visual tokens: cream, blush, powder-blue, warm-white, and cocoa tokens were mapped into global WXSS.
- Image quality and asset fidelity: generated PNG source is preserved outside the mini-program package; runtime crops are JPEG-compressed to keep the main package lean.
- Copy and content: all three card labels and four navigation labels match the source visual.
- JavaScript, JSON, and local image references were validated.

## Comparison history

- No visual iteration was possible without a rendered implementation screenshot.

## Follow-up polish

- Confirm safe-area spacing on an iPhone-sized simulator and one Android device.
- If the platform font appears too rigid, add a licensed rounded Chinese UI font as a local asset in a later pass.

final result: blocked
