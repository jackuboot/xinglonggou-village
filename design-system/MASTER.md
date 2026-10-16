# 兴隆沟村设计系统 · 山野秩序

版本：1.0.0。适用范围：`web/` 官网与 `dashboard/` 数字工作台。设计原则：保留深林绿、麦穗金的乡村品牌，让正文清楚、操作明确、布局安静；不用通用模板替换已有品牌。

## 1. 唯一依据与优先级

1. 用户明确要求与业务/权限边界不可改变。
2. [tokens.json](tokens.json) 是颜色、间距、字号、圆角、动效、角色主题的唯一值源；[icons.json](icons.json) 是功能 SVG 唯一源。
3. 本规范规定用途和例外；[catalog.html](catalog.html) 是由源文件生成的可打开、可交互样本。
4. 应用内 `tokens.css`、`icons.generated.js` 和官网 `scripts/icons.js` 是生成快照，不手改，不在页面重复定义品牌。
5. 旧 Wiki 中“无共享代码”描述针对原始架构。本次新增仓库级设计源和开发期门禁；两个应用运行时不互相引用，仍分别打包/部署，构建需完整仓库。角色路由、导航数据和权限守卫仍各自独立。

设计决策/变更入口在这里，不在自动维护的 Wiki 中创建第二套规范。视觉变更同时更新依据、生成样本和验证记录。

## 2. 三层变量

`primitive` 原始值 → `semantic` 用途 → `component` 控件。组件不直接引用原始色板。`aliases` 仅兼容旧 `--c-primary` / `--brand` 等名称，不代表第二套主题。

| 用途 | 变量 | 规则 |
| --- | --- | --- |
| 主操作 | `--color-primary` / `--button-bg` | 深林绿；所有角色一致；一屏一个主要操作方向 |
| 主操作悬停 | `--color-primary-hover` | 深绿，不使用位移制造反馈 |
| 强调 | `--color-accent` | 麦穗金仅装饰、大面积强调；不能用金底白字 |
| 金色小字/徽标 | `--color-accent-ink` + `--color-accent-soft` | 深金字，浅金底；对比度门禁覆盖 |
| 页面/阅读区 | `--color-canvas` / `--color-paper` | 工作台浅灰绿、官网米白；白卡片分隔内容 |
| 照片文字托底 | `--color-scrim-paper` / `--color-scrim-paper-soft` | 仅官网首屏：在照片上盖纸色渐隐，保证左侧文字始终落在接近不透明的底上；窄屏改为自下而上的纸色过渡 |
| 正文/辅助文字 | `--color-text` / `--color-text-muted` | 普通文字均按至少 4.5:1 检查，不以浅灰降低可读性 |
| 表单边界 | `--input-border` | 可交互边界至少 3:1；装饰卡片边框可低对比 |
| 危险/错误 | `--color-danger` + `--color-danger-soft` | 必须带文字说明和恢复路径，不能借用角色色 |
| 焦点 | `--color-focus` | 可见 3px 外框；深色背景改用可读亮色焦点 |

允许用 `color-mix()` 从语义变量派生装饰覆盖色；派生颜色不自动视为满足文字对比度，必须对实际背景复核。当前仅支持浅色正文和深色品牌区域，不提供全站暗色切换，不宣称已验证暗色模式。

## 3. 角色主题与独立性

`[data-role]` 统一设置 `--role-accent` / `--role-accent-soft` / `--role-accent-ink` / `--role-accent-light` / `--role-deep`。农户禾绿、入库员土褐、消费者深林绿、审计员蓝灰、管理后台墨绿深金。后台文字强调使用深金，不覆盖 `--brand`。

五个角色保留独立 Shell、NAV、路由和按需加载；只复用 `dashboard/src/core/styles/workspace.css` 布局。角色主题适用于导航、身份标识和入口图标，不能改变成功/失败语义或访问权限。当前项同时使用文字、图标与选中标识，不能只靠颜色。

## 4. 布局与排版

- 基础间距 4px；常用 8/12/16/24/32/48px。容器上限 1120px。桌面侧栏 240px，主内容 `min-width: 0`，网格列使用可收缩尺寸。
- 工作台 900px 切换桌面侧栏/手机底部导航，底部不超过 5 项。官网按移动优先排列：默认单列；≥600px 数据带四列、联系两列；≥768px 产业行与资讯改为左右两段；≥900px 故事三列；≥1024px 恢复完整顶栏导航、首屏改为照片托底、介绍区两列、联系四列；<1024px 顶栏收为菜单按钮、首屏为照片在上文字在下。工作台局部 480/560px 用于密集表单，899/900px 为互斥边界。合法断点见 `tokens.json.breakpoints`，新增须说明用途。CSS 自定义变量不能直接用于媒体查询，因此数值由门禁登记检查。
- 验证宽度：320、375、600、768、900、1024、1440px；另检查 812×375 横屏和文字放大。表格/地图确需双向布局时才允许局部滚动，不得用页面 `overflow-x: hidden` 掩盖溢出。
- 正文基准 16px，辅助字 12–14px，表单输入至少 16px；行高约 1.6–1.95。层级优先靠字号、字重、间距，避免一屏重复显示同一页面标题。
- 字体分工：正文、控件、导航统一 `--font-sans`；官网的标题、产品名、引文与数字另用 `--font-serif`（中文衬线栈）形成编辑式层级，工作台不使用衬线。全部为系统字体，不加载外部字体文件或 CDN。
- 官网首屏与介绍区使用照片：由项目自有 `og.png` 派生的多尺寸文件放在 `web/src/assets/`，用 `srcset` + 显式 `width/height` 避免跳动，首屏图 `fetchpriority="high"`、介绍图 `loading="lazy"` 并带替代文字与说明。换图按同名覆盖即可，不必改模板；替换后需同步更新 `site.json` 中的替代文字与说明。首屏图是装饰性背景，对读屏隐藏，含义由标题与正文承担；当前图片是自有素材派生的占位图，上线前应换成村里实拍。
- 圆角：小元素 4/10px、输入 12px、工作台卡片 16px、大面板 20px、主按钮胶囊。官网按钮与复制按钮用胶囊、照片与图标块用 4–10px，与工作台更强操作感区分；复用同一圆角尺度，不另建值源。阴影按 sm/md/lg，静态内容主要以边线区分。
- 固定顶栏、底栏需预留正文空间；安全区使用 `env(safe-area-inset-*)`；矮屏导航可滚动。用户信息集中在桌面侧栏，手机的切换/退出入口不能丢失。

## 5. 图标

功能图标统一 `24×24 viewBox / 1.8 stroke / round cap & join / currentColor`；常用视觉尺寸 16/20/24px，品牌/空状态可放大。图标视觉尺寸不等于点击区域：按钮目标至少 44×44 CSS px。原有 18/22/26 等展示尺寸可逐步收敛，不新增另一套图标库。

Vue 使用 `Icon` 组件；官网模板使用 `iconSvg` 或 `uiIcons`。未知名称门禁报错，运行时回退为 leaf 保持容错。装饰 SVG `aria-hidden` 且不可聚焦；纯图标按钮由按钮提供 `aria-label`。不使用 emoji 或字符箭头替代功能图标。

允许的例外：官网品牌 Logo 与 favicon 是品牌资源，不是功能图标，可保留独立路径与美术颜色；模板 theme-color 是浏览器元数据。门禁检查 CSS / inline style 原始色，不把照片像素或品牌 SVG 的属性色当成 UI token。品牌 Logo 例外不能用于按钮或功能图标。

## 6. 交互状态规格

| 组件 | 默认/悬停与焦点 | 忙碌/禁用/错误 |
| --- | --- | --- |
| 主按钮 | 默认绿底白字；官网深色首屏/合作区用金底深绿字；hover 加深/提亮；键盘外框；按下轻微反馈 | 处理中有中文文字、`aria-busy`、禁重复提交；禁用不是“功能未实现”的占位方式 |
| 输入 | 永久 label；16px；44px高度；焦点边界可见 | blur 后校验；错误紧邻字段；`aria-invalid`、`aria-describedby`；错误不能只靠红边 |
| 导航 | 当前项与 `aria-current` 同步 | 折叠菜单 Esc 关闭回焦点，断点变化复位，不阻挡正常 Tab |
| 占位入口 | 保持可达，统一“即将上线” | 不伪造已有业务数据或可用能力 |
| 卡片 | 只读卡片不使用浮起/移动暗示点击 | 真正的链接卡片才有 hover/focus 与明确进入动作 |
| Toast | `role=status`，中文反馈，可换行、不抢焦点 | 安全区内且不被底栏遮挡；重要失败仍有页面内说明 |
| 危险操作 | 与普通操作分隔，使用危险语义 | 保留既有确认和权限校验；纯样式改造不得删除确认流程 |

微交互 150–300ms，主要用 opacity/transform/color，不使用 `transition: all`，不做持续无意义浮动。`prefers-reduced-motion` 下关闭/缩短动画，确保内容始终可见。加载、空态、错误、完成均有清楚的文字，读屏不依赖颜色。

## 7. 修改流程与自动门禁

从仓库根目录运行（Node 22.12+；工作台依赖按锁文件安装）：

```sh
npm ci --prefix dashboard
npm run design:sync       # 修改tokens/icons后重建快照与catalog
npm run check:design      # 只检查，不写文件
npm test                  # 门禁自身的正反例测试
npm run check             # 上述检查 + 两端生产构建
npm run test:ui           # 本地Chrome/Edge，多尺寸/交互回归，需先构建官网
```

`test:ui` 使用独立测试服务与明确模拟的身份/用户记录，不修改生产鉴权，不发送短信、不写授权，不接触真实账号。测试会阻断所有非本地请求，结果与截图写入已忽略的 `design-system/reports/`；可设置 `CHROME_PATH` 指定浏览器。CI当前只运行静态门禁/测试/构建，浏览器检查需在有浏览器的环境显式执行。

两个构建入口已接入门禁，`.github/workflows/design-check.yml` 在推送/PR检查。不要直接运行裸 vite 绕开项目 build 脚本。检查范围：快照一致性、引用有效/无环、原始颜色/原始色板、图标清单、字号下限、登记断点、焦点轮廓、五角色布局引用、核心颜色对比度。

新增 token 要说明用途及所属层；新增主题/断点/例外要在本规范说明理由并增加测试。不得为通过检查增加无理由的忽略名单。更改布局后补多尺寸截图/交互检查，记录在 [验证记录](verification.md)。

静态门禁不等于完整 WCAG 审计：它不能证明组合后的全部对比度、长内容、屏幕阅读器体验或真实登录/授权正确；这些必须实测。权限、CloudBase配置、数据模型、短信和云函数不属于本次设计改造范围。

## 8. 决策与依据

| 决策 | 依据 | 取舍 |
| --- | --- | --- |
| 保留绿色/金色，不改成通用棕色主题 | 改造前 web/style.css 和 dashboard/base.css 同一品牌色；乡村产品定位 | 用户历史通用审美仅作为留白/简洁参考，不能覆盖当前项目明确品牌 |
| 三层token + 生成快照 | UI/UX Pro Max `design-system` token-architecture；原双端颜色重复定义 | 开发期统一治理；无跨应用运行时请求 |
| 更深辅助文字/金色文字 | WCAG 普通文本4.5:1；旧浅灰与金色不足 | 保留明亮金色作为装饰，不作白字按钮背景 |
| 共享样式不合并五区逻辑 | 现有 Shell 明确独立应用边界 | 修正布局一致性不改鉴权和导航数据 |
| 系统中文字体，不加载推荐英文字体/CDN | 中文用户与零额外运行时依赖 | 技能搜索给出的 Atkinson 字体不适合直接替换中文字体栈 |
| 安静的编辑式布局 | UI/UX Pro Max 可读性、焦点、导航、反馈规则 | 检索推荐的 Vibrant & Block-based、论坛结构不适配该站，未机械套用 |
| 官网改为编辑式（照片 + 衬线 + 序号清单） | 用户在两个视觉方案中选定「山野纪事」；原首屏为整块深绿、产业为卡片网格 | 只换版式、字体分工与图片，保留全部文案、锚点与 SEO；工作台不在本次范围 |
| 官网首屏/介绍区改用照片 | 照片是乡村品牌最强的信任载体；项目已有自有资产 `og.png` | 由自有素材派生多尺寸文件，不引入第三方素材；当前为占位图，上线前换实拍 |

2026-10-16 使用 UI/UX Pro Max 2.6.2 检索：

```text
"rural agriculture community platform trustworthy warm green gold accessible content-first" --design-system
"responsive navigation focus loading accessibility" --domain ux -n 6
"accessibility component composition" --stack vue -n 4
```

公开依据：[WCAG 2.2 对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)、[Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)、[Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)、[Vue 无障碍](https://vuejs.org/guide/best-practices/accessibility.html)。44px 是本项目更严格的触控设计标准，并非把 WCAG 2.2 AA 的24px最低要求误写为44px。
