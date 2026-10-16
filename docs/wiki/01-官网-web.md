# 01 · 官网（web/）

> 职责范围：`web/` 目录全部内容。

## 定位

面向公众的 SEO 静态官网，纯 HTML/CSS/JS，无框架、无运行时依赖。核心设计：**内容与结构彻底分离**——所有文字内容集中在 `content/site.json`，页面结构与样式在 `src/index.html` + `src/css/style.css`。

## 内容模型（content/site.json）

该文件是网站全部文字的唯一入口，改完保存后运行 `deploy.ps1` 即构建上线：

- `site`：站名、slogan、SEO 元信息（title/description/keywords/canonical）、`dashboardUrl`（工作台入口，指向 `/app/`）、`nav`（锚点导航，href 固定为 `#home/#about/#industry/#stories/#news/#contact`，只许改 label）。
- `hero` / `stats` / `about` / `products` / `stories` / `news` / `contact` 等分节内容。
- `products`、`stories`、`news` 为数组：复制一段花括号块即新增，删除整块即下线，页面自动重排。
- `icon` 字段只能用 `scripts/icons.js` 中注册的名称（sprout/camera/coin/leaf/drop/rice/veggie/basket/bottle），未知图标回退为 leaf。
- 以 `_` 开头的字段（如 `_readme`）为编辑说明，构建时忽略。

## 构建与模板语法（scripts/build.js）

自研微模板（无第三方依赖），三种语法：

- `{{路径}}`：取值并 HTML 转义输出（如 `{{site.name}}`）。
- `{{{路径}}}`：原样输出，用于图标 SVG（`{{{iconSvg}}}`）与 JSON-LD。
- `{{#each 路径}}…{{/each}}`：遍历数组，循环体内可直接用条目字段。

构建产物输出到 `dist/`（构建产物，禁止手改），并自动生成 `ogImageUrl` 与 `jsonLd`（无需在 site.json 填写）。本地预览：`preview.ps1` 或 `node scripts/serve.cjs`。

## SEO 要点

- 完整 meta：description / keywords / canonical / Open Graph / Twitter Card / JSON-LD 结构化数据。
- `robots.txt` 单独部署到**域名根目录**（官网本体在子路径，爬虫只认根目录的 robots.txt）。

## 部署（deploy.ps1）

1. `node scripts\build.js` 构建 `dist/`。
2. `tcb hosting deploy dist /9e3840e6-7054-452d-b9f5-5462917056e2 -e <环境ID>` 部署到 CloudBase 静态托管子路径。
3. 追加部署 `dist\robots.txt` 到 `/robots.txt`（失败不阻塞）。

## 同步记录

- 2026-10-16 初始生成，基于 commit 6819374。
