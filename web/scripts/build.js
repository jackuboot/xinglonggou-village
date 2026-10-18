#!/usr/bin/env node
/**
 * 构建脚本：读取 content/site.json，套用 src/index.html 模板，输出 dist/
 * 用法：node scripts/build.js
 * 语法约定：
 *   {{路径}}      转义后输出（如 {{site.name}}）
 *   {{{路径}}}    原样输出，用于图标 SVG（如 {{{iconSvg}}}）
 *   {{#each 路径}} ... {{/each}}  遍历数组，循环体内可用条目字段
 */
const fs = require('fs');
const path = require('path');
const { ICONS } = require('./icons');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const DOCTYPE = '<!DOCTYPE html>';
const BANNER = '<!-- 本文件由 scripts/build.js 自动生成，请勿手改；内容请编辑 content/site.json，然后运行 deploy.ps1 -->';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lookup(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function render(tpl, ctx) {
  let out = tpl.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, keyPath, body) => {
    const arr = lookup(ctx, keyPath);
    if (!Array.isArray(arr)) return '';
    return arr.map(item => render(body, Object.assign({}, ctx, item))).join('');
  });
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, keyPath) => {
    const v = lookup(ctx, keyPath);
    return v == null ? '' : String(v);
  });
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_, keyPath) => {
    const v = lookup(ctx, keyPath);
    return v == null ? '' : escapeHtml(v);
  });
  return out;
}

function main() {
  // 在完整仓库中构建须通过设计门禁；部署产物不引用另一个应用。
  require('../../scripts/check-design.cjs').run().length && process.exit(1);
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));
  content.uiIcons = ICONS;

  // 图标名 → SVG，供模板 {{{iconSvg}}} 使用；未知图标回退为 leaf
  const withIcon = item => Object.assign({}, item, {
    iconSvg: ICONS[item.icon] || ICONS.leaf,
  });
  content.products = (content.products || []).map((item, index) => Object.assign(withIcon(item), {
    // 序号由构建生成，增删产品后自动重排，内容文件里不用手写。
    no: String(index + 1).padStart(2, '0'),
  }));
  content.about.features = (content.about.features || []).map(withIcon);
  // 农户头像取姓名首字
  content.stories = (content.stories || []).map(s => Object.assign({}, s, {
    avatarChar: String(s.name || '农').trim().charAt(0),
  }));

  // SEO 派生字段：og 图绝对地址与结构化数据（JSON-LD），内容文件中无需填写
  const siteUrl = String(content.site.url || '').replace(/\/?$/, '/');
  content.site.ogImageUrl = siteUrl + 'og.jpg';
  content.site.jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': siteUrl + '#website',
        name: content.site.name + ' · ' + content.site.tagline,
        url: siteUrl,
        description: content.site.description,
        inLanguage: 'zh-CN'
      },
      {
        '@type': 'Organization',
        '@id': siteUrl + '#organization',
        name: content.site.name + '村民委员会',
        url: siteUrl,
        logo: siteUrl + 'favicon.svg',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: content.contact.phone,
          contactType: 'customer service',
          areaServed: 'CN',
          availableLanguage: ['zh-CN']
        }
      }
    ]
  });

  const tpl = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const html = render(tpl, content);

  const leftovers = html.match(/\{\{[^}]*\}\}/g);
  if (leftovers) {
    console.warn('[!] 存在未解析的占位符，请检查 content/site.json 是否缺少对应字段：');
    leftovers.forEach(s => console.warn('    ' + s));
    process.exitCode = 1;
  }

  try {
    fs.rmSync(DIST, { recursive: true, force: true });
  } catch (e) {
    /* dist/ 清理失败（如沙箱限制）时，降级为直接覆盖同名文件 */
  }
  fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    html.startsWith(DOCTYPE)
      ? DOCTYPE + '\n' + BANNER + html.slice(DOCTYPE.length)
      : BANNER + '\n' + html
  );
  fs.copyFileSync(path.join(SRC, 'css', 'style.css'), path.join(DIST, 'css', 'style.css'));
  fs.copyFileSync(path.join(SRC, 'css', 'tokens.css'), path.join(DIST, 'css', 'tokens.css'));
  fs.copyFileSync(path.join(SRC, 'js', 'app.js'), path.join(DIST, 'js', 'app.js'));
  fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));

  // 图片等静态资源整目录拷贝；页面里用相对路径引用（如 assets/hero-1600.jpg）。
  // 换图只需覆盖同名文件，无需改内容或模板。
  const ASSET_SRC = path.join(SRC, 'assets');
  if (fs.existsSync(ASSET_SRC)) {
    fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
    for (const entry of fs.readdirSync(ASSET_SRC, { withFileTypes: true })) {
      if (entry.isFile()) fs.copyFileSync(path.join(ASSET_SRC, entry.name), path.join(DIST, 'assets', entry.name));
    }
  }

  // SEO 附属文件：分享图（1200×630，社交平台标准尺寸）、robots.txt、sitemap.xml
  const ogSrc = path.join(SRC, 'og.jpg');
  if (fs.existsSync(ogSrc)) fs.copyFileSync(ogSrc, path.join(DIST, 'og.jpg'));

  fs.writeFileSync(path.join(DIST, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + siteUrl + 'sitemap.xml\n');

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url>\n    <loc>' + siteUrl + '</loc>\n' +
    '    <lastmod>' + new Date().toISOString().slice(0, 10) + '</lastmod>\n' +
    '    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n' +
    '</urlset>\n');

  if (!process.exitCode) {
    console.log('[ok] build complete -> dist/ (index.html, css/style.css, js/app.js, favicon.svg, assets/, robots.txt, sitemap.xml, og.jpg)');
  }
}

main();
