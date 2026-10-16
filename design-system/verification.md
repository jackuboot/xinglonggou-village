# 设计改造验证记录

日期：2026-10-16。设计版本：1.0.0。改造基线：Git `07907ba`；本记录对应其上的本地未提交变更，不代表线上版本。规范入口：[MASTER.md](MASTER.md)，可视样本：[catalog.html](catalog.html)。

## 验收结论

官网与五个独立角色工作台已共用设计值源和功能图标源，保持各自路由、导航及构建产物。颜色、排版、布局、图标、响应式和交互规则已形成「规范 → 源文件 → 生成快照 → 自动门禁 → 浏览器回归」链路。

本地生产构建和下述检查全部通过。未提交、推送或部署；未调用真实短信、登录、角色授权或撤销接口。本记录不是完整 WCAG 合规认证，也不是业务端到端验收。

## 实际执行结果

环境：Windows，Node v24.18.0，Vite v8.3.4，本机 Chrome 无头浏览器。浏览器最终运行时间：2026-10-16 10:22:12–10:22:25 UTC。

| 检查 | 实际结果 | 可复现入口 |
| --- | --- | --- |
| 设计源与生成快照 | 42 个源文件、171 个根变量、36 个功能图标；通过 | `npm run check:design` |
| 固定颜色组合对比度 | 38 组通过各自阈值；普通文字4.5:1，控件边界/焦点3:1 | `node scripts/check-design.cjs --json` |
| 门禁自身的正反例测试 | 7/7通过，包括原始颜色、未知变量、循环引用、非法断点、焦点和小字号 | `npm test` |
| 官网生产构建 | 通过，保留内容模板、锚点、SEO产物；复制生成的tokens.css | `npm run build:web` |
| 工作台生产构建 | 通过；81个模块；保留按角色拆分产物 | `npm run build:dashboard` |
| 浏览器布局与交互 | 82组布局测量、185项断言通过；报告共267条记录，失败0 | `npm run test:ui` |
| 非本地请求 | 本次测试记录0次；测试拦截器禁止非本地请求 | [browser-check.json](reports/browser-check.json) |
| 差异格式与业务边界 | `git diff --check`通过；核心鉴权、角色、路由、API和云函数未修改 | 工作树相对基线的Git差异 |

浏览器脚本使用独立 Vite 测试进程替换认证 composable 和管理API，数据标明为模拟。生产源码、生产打包配置中没有加入测试后门；真实登录/短信/授权函数在夹具中会拒绝调用。剪贴板也在测试页面内模拟，没有写入用户剪贴板。

## 覆盖范围

官网检查320×800、375×812、768×1024、900×800、1024×768、1440×960、812×375。每次检查页面横向溢出与可见按钮44px目标；并检查375px和1440px下根字号200%的布局。

工作台检查登录、身份选择、五个角色首页、管理授权、农户账号及农产品页，覆盖320、375、768、1024、1440px宽与812×375横屏。其余十个角色业务/账号路由在375px检查；管理列表另测空数据、错误和长UID/长姓名。手机管理总览另测根字号200%。字号修改用于文本放大抽样，不等同于所有浏览器的页面缩放测试。

交互回归覆盖：官网菜单展开、Esc关闭回焦点、跨断点复位；复制忙状态、模拟成功和失败反馈；登录真实输入事件/Tab失焦错误；五角色跳至正文不改变hash；子路由切换后的正文焦点；管理编辑回填聚焦UID、跳过导航保留未保存表单；手机管理身份切换；设计目录图标过滤；减少动态效果模式。

报告中的 `overflow` 诊断可能列出官网被hero局部裁切的装饰太阳；它为 `aria-hidden` 装饰，不会扩大文档宽度，不是正文溢出。没有通过全页隐藏横向溢出来让断言通过。

## 视觉复核截图

已打开并检查以下样本的内容层级、控件、换行和导航布局。截图与机器报告为本地可再生成产物，位于已忽略的 `reports/`，不会随Git提交；新克隆仓库需先构建官网，再运行 `npm run test:ui` 生成。

| 样本 | 截图 |
| --- | --- |
| 官网手机/桌面首屏 | [375px](reports/web-375.png) · [1440px](reports/web-1440.png) |
| 官网产品/联系区域 | [产品375px](reports/web-industry-375.png) · [联系1440px](reports/web-contact-1440.png) |
| 登录及角色选择 | [登录375px](reports/fixture-login-375.png) · [选择375px](reports/fixture-select-375.png) |
| 管理授权/农户首页 | [授权375px](reports/fixture-admin-users-375.png) · [农户1440px](reports/fixture-farmer-1440.png) |
| 设计目录 | [目录1440px](reports/catalog-1440.png) |

工作台截图全部是本地模拟身份和模拟用户，不应当作线上业务数据。

## 修正与证据索引

| 问题/规则 | 本次处理 | 源码与依据 |
| --- | --- | --- |
| 颜色重复定义、角色风格易漂移 | 三层token，保留兼容别名；角色覆盖集中登记；独立应用内生成相同快照 | [tokens.json](tokens.json) · [生成器](../scripts/design-system.cjs) |
| 金色配白字及辅助文字不足 | 金色配深绿字；小字使用深金；加深辅助字与占位文字 | [规范§2](MASTER.md#2-三层变量) · tokens中的contrastPairs |
| 表单灰底上的占位文字 | 复核发现原选值仅4.35:1；改为更深语义值达到5.46:1，并加入门禁 | `color-placeholder` / `color-surface-muted` |
| 功能图标不统一 | 36个图标统一24×24、1.8描边与currentColor；服务时间使用clock；文字箭头改为SVG | [icons.json](icons.json) · [Icon.vue](../dashboard/src/core/components/Icon.vue) |
| Shell复制样式与手机管理操作缺失 | 只共享展示样式；各区NAV和路由保留；手机管理可切换身份与退出 | [workspace.css](../dashboard/src/core/styles/workspace.css) · [AdminShell.vue](../dashboard/src/apps/admin/AdminShell.vue) |
| 跳过导航与hash路由冲突 | 阻止锚点默认写hash，显式聚焦main；回归验证未保存表单不丢失 | [focus.js](../dashboard/src/core/focus.js) · 五个Shell与[App.vue](../dashboard/src/App.vue) |
| 登录失焦错误与测试时序 | 明确字段反馈；测试等路由过渡完成，使用真实输入/Tab事件，避免同一同步脚本内的焦点时序假失败 | [LoginPage.vue](../dashboard/src/gateway/LoginPage.vue) · [verify-design.mjs](../scripts/verify-design.mjs) |
| 菜单、复制、静态卡片假交互 | Esc回焦点、断点复位；复制忙/成功/失败反馈；静态卡片不浮起 | [官网JS](../web/src/js/app.js) · [官网CSS](../web/src/css/style.css) |
| 编辑授权时的焦点和动效 | 回填后聚焦UID，滚动尊重减少动态效果；不改保存、确认、撤销函数 | [AdminUsersPage.vue](../dashboard/src/apps/admin/pages/AdminUsersPage.vue) |
| 规范执行而非只写文档 | 两个build入口和CI调用门禁；官网ui文案缺失也报错 | [门禁](../scripts/check-design.cjs) · [门禁测试](../scripts/design-system.test.cjs) · [CI](../.github/workflows/design-check.yml) |

设计方法和公开标准链接见[规范§8](MASTER.md#8-决策与依据)，其中记录了技能版本、检索词以及没有机械采用通用模板的取舍。

## 第二轮：官网首页改为方案 A「山野纪事」（2026-10-16）

用户在两个视觉方向中选定方案 A。本轮只改官网首页，工作台未改。

改动文件：`web/src/index.html`、`web/src/css/style.css`（重写）；`web/scripts/build.js`（拷贝 `src/assets`、为产品自动生成序号）；`web/content/site.json`（新增图片字段与图片说明）；`design-system/tokens.json`（新增 `--font-serif` 与两个纸色遮罩语义色）。全部文案、锚点（#home/#about/#industry/#stories/#news/#contact）、SEO 元信息、JSON-LD、导航菜单交互与复制反馈逻辑均保留。

版式要点：手机优先单列 → ≥600px 数据带四列、联系两列 → ≥768px 产业行三段、资讯左右两段 → ≥900px 故事三列 → ≥1024px 恢复完整顶栏、首屏改为照片托底（左侧纸色渐隐，保证文字落在接近不透明的底上）、介绍区两列、联系四列。标题、产品名、引文与数字用衬线，正文与控件继续用无衬线。

图片由项目自有 `web/src/og.png`（原本用于社交分享）派生，不引入任何第三方素材：

| 文件 | 尺寸 | 体积 |
| --- | --- | --- |
| `src/assets/hero-1600.jpg` / `hero-900.jpg` | 1600×900 / 900×506 | 221 KB / 77 KB |
| `src/assets/village-1200.jpg` / `village-700.jpg` | 1200×800 / 700×467 | 151 KB / 56 KB |

首屏图 `fetchpriority="high"`，作装饰性背景对读屏隐藏；介绍图 `loading="lazy"`，带替代文字与图注；两者都用 `srcset` 与显式 `width/height`。

本轮验证结果（同一环境，Node v24.18.0）：

| 检查 | 实际结果 |
| --- | --- |
| 设计门禁 | 42 源文件 / 174 变量 / 36 图标 / 38 对比度组合；通过，新增 token 已登记 |
| 门禁自测 | 7/7 通过 |
| 两端生产构建 | 官网与工作台均通过；工作台主包 646.79 kB（gzip 172.17 kB）警告保留 |
| 浏览器回归 | 267 项记录、0 失败；官网 320/375/768/1024/1440 与 812×375 无横向溢出、可见按钮 ≥44px；菜单展开、Esc 回焦点、断点复位、复制忙/成功/失败反馈通过 |
| 官网专项多尺寸 | 320/375/600/768/900/1024/1440 与 812×375 共 8 个视口：无横向溢出、无过小可点目标、无未替换占位符 |

本轮修复的两个真实缺陷：`.hero > .container` 的 `width:100%` 覆盖了容器居中宽度，导致宽屏首屏文字贴左被裁切；产业序号在 `align-items:center` 下与产品名错位。两者已修复并复验。

分段与整页截图（本地可再生成，位于已忽略的 `design-system/reports/directions/`）：[首屏1440](reports/directions/site-hero-1440.png) · [首屏375](reports/directions/site-hero-375.png) · [整页1440](reports/directions/site-1440.png) · [整页375](reports/directions/site-375.png)，以及 `sec-about|industry|stories|news|contact-{375,1440}.png` 五组分段图。

未验证：未在真机 iOS/Android 与 Safari 上查看；未做完整读屏走查；未部署。

## 未覆盖及后续维护

- 没有测试真实短信、CloudBase会话、权限变更、管理员撤销或真实数据。基于Git差异的只读复核确认这些核心边界没有被改造；夹具测试不能代替后续业务验收。
- 浏览器自动化使用本机Chrome及模拟视口；未执行真机iOS/Android、Safari、完整读屏、触屏手势或全部文字放大组合测试。
- 自动颜色检查覆盖登记的不透明颜色对；渐变、透明覆盖和任意未来组合仍需要页面复核。当前没有完整暗色模式。
- 保留了Vite主包超过500kB的警告：本次产物约646.79kB、gzip172.16kB。没有提高警告阈值来隐藏它，也没有越界改造鉴权依赖或打包策略。
- GitHub Actions配置已落盘，本次未推送，所以没有远程CI运行结论；本地运行的是相同检查命令。CI目前不自动执行浏览器回归。
- 所有后续视觉变更先修改统一源和用途说明，再同步快照、执行检查、更新验证记录。静态门禁降低风格漂移风险，不能替代评审，更不能保证所有未来UI都自动符合规范。
- 官网首屏与介绍区的照片是由项目自有 `og.png` 派生的占位图，不是兴隆沟村实拍；`site.json` 中的替代文字与图注同样是示例。上线前必须换成村里真实照片，并同步更新这两处文字。
