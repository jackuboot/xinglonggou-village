#!/usr/bin/env node
/** 设计源 → 两个独立工程内的只读快照。node scripts/design-system.cjs [--check] */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'design-system', name), 'utf8'));
const cssValue = value => value.replace(/\{([\w-]+)\}/g, 'var(--$1)');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderTokens(tokens) {
  const lines = ['/* 自动生成；只修改 design-system/tokens.json，然后运行 node scripts/design-system.cjs */', ':root {'];
  for (const layer of ['primitive', 'semantic', 'component', 'aliases']) {
    lines.push(`  /* ${layer} */`);
    for (const [name, value] of Object.entries(tokens[layer])) lines.push(`  --${name}: ${cssValue(value)};`);
  }
  lines.push('}');
  // 五个工作台与官网共用同一套颜色，因此不再生成 [data-role] 覆盖块；
  // 组件层的 --role-* 默认值即全站统一值，页面上的 data-role 只作为结构/测试钩子。
  return lines.join('\n') + '\n';
}
function svg(registry, body) {
  return `<svg viewBox="${registry.viewBox}" fill="none" stroke="currentColor" stroke-width="${registry.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
function renderCatalog(tokens, registry) {
  const palette = ['primary', 'primary-hover', 'accent', 'accent-ink', 'paper', 'canvas', 'surface', 'text', 'text-muted', 'danger'];
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>兴隆沟村 · 设计规范样本</title>
<style>
${renderTokens(tokens)}
*{box-sizing:border-box}body{margin:0;background:var(--color-paper);color:var(--color-text);font:var(--text-base)/1.65 var(--font-sans)}main{max-width:var(--layout-content);margin:auto;padding:var(--space-10) var(--space-5)}h1{font-size:clamp(1.8rem,5vw,3rem);margin:0}h2{margin:0 0 var(--space-5)}p{color:var(--color-text-muted)}section{margin-top:var(--space-10)}.eyebrow{font-size:var(--text-sm);color:var(--color-primary);font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:var(--space-4)}.panel{background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--card-radius);padding:var(--card-padding)}.swatch{height:64px;border-radius:var(--radius-sm);border:1px solid var(--color-border);margin-bottom:var(--space-3)}code{overflow-wrap:anywhere;font-size:var(--text-xs)}.row{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center}.btn{font:inherit;min-height:var(--control-height);padding:var(--space-2) var(--space-5);border-radius:var(--button-radius);border:1px solid var(--color-border-strong);background:var(--color-surface);color:var(--color-text);cursor:pointer;transition:background var(--duration-normal)}.primary{background:var(--button-bg);color:var(--button-fg);border-color:var(--button-bg)}.primary:hover{background:var(--button-hover-bg)}.danger{color:var(--color-danger);border-color:var(--color-danger)}.btn:disabled{opacity:.55;cursor:not-allowed}:focus-visible{outline:3px solid var(--color-focus);outline-offset:3px}.role{border-top:4px solid var(--role-accent)}.role strong{color:var(--role-accent-ink)}.role span{display:block;background:var(--role-deep);color:var(--color-on-dark-muted);padding:var(--space-3);border-radius:var(--radius-sm);margin-top:var(--space-3)}.icons{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}.icon{display:grid;justify-items:center;gap:var(--space-3);padding:var(--space-4);text-align:center}.icon svg{width:24px;height:24px;color:var(--color-primary)}[hidden]{display:none!important}label{display:block;font-weight:600}input{font:inherit;min-height:var(--control-height);padding:var(--space-3);border:1px solid var(--input-border);border-radius:var(--input-radius);width:min(100%,400px);margin:var(--space-2) 0 var(--space-4)}.note{background:var(--color-primary-soft);border-left:3px solid var(--color-primary);padding:var(--space-4)}a{color:var(--color-primary)}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><main>
<header><div class="eyebrow">兴隆沟村 / DESIGN SYSTEM ${escape(tokens.version)}</div><h1>山野有温度，界面有秩序。</h1><p>这是设计组件样本，不是业务页面。来自统一设计源，执行生成命令即可同步；规范与变更流程见 <a href="MASTER.md">MASTER.md</a>。</p></header>
<section aria-labelledby="palette"><h2 id="palette">01 / 颜色与语义</h2><div class="grid">${palette.map(name => `<div class="panel"><div class="swatch" style="background:var(--color-${name})"></div><code>--color-${name}</code></div>`).join('')}</div><p class="note">深林绿用于主要操作；麦穗金用于强调与装饰，正文使用深金 accent-ink。不要用金底白字，不要以颜色单独表达角色或状态。</p></section>
<section aria-labelledby="states"><h2 id="states">02 / 控件与状态</h2><div class="panel"><div class="row"><button class="btn primary" data-feedback="示例：主要操作已完成">主要操作</button><button class="btn" data-feedback="示例：次要操作已完成">次要操作</button><button class="btn danger" data-feedback="仅展示危险操作外观，不执行删除">危险操作样本</button><button class="btn primary" disabled>处理中…</button></div><p id="feedback" role="status" aria-live="polite">可用 Tab 检查焦点，用 Enter / 空格激活按钮。此页不会访问后端。</p><label for="example">输入框样本</label><input id="example" placeholder="正文输入 16px，控件至少 44px" aria-describedby="input-help"><p id="input-help">标签始终可见；错误说明原因并给出恢复方法；加载状态防止重复提交。</p></div></section>
<section aria-labelledby="roles"><h2 id="roles">03 / 角色标识，共用同一色系</h2><div class="grid">${[['farmer', '农户'], ['keeper', '入库员'], ['consumer', '消费者'], ['auditor', '审计员'], ['admin', '管理后台']].map(([id, label]) => `<div class="panel role" data-role="${id}"><strong>${label}</strong><p>五个工作台与官网共用深林绿 + 麦穗金，不再各自配色；靠名称、图标与当前项标识区分，不能只依赖颜色。</p><span>深色侧栏辅助文字</span></div>`).join('')}</div></section>
<section aria-labelledby="layout"><h2 id="layout">04 / 布局与交互约束</h2><div class="panel"><p>4px 基础间距；内容上限 1120px；工作台 900px 切换侧栏与底部导航；官网以内容实际拥挤点确定导航断点。320 / 375 / 768 / 1024 / 1440px 检查，不用 overflow-x:hidden 掩盖布局问题。</p><p>圆角：输入 12px、工作台卡片 16px、大面板 20px、工作台主按钮胶囊；官网编辑式控件/产品卡片 10px。普通交互 150–300ms，静态卡片不浮动，尊重减少动态效果与安全区。</p><p>当前仅维护浅色内容 + 深色品牌区，不宣称支持全站暗色模式。</p></div></section>
<section aria-labelledby="icons"><h2 id="icons">05 / 单一 SVG 图标目录</h2><label for="icon-filter">按名称筛选图标</label><input id="icon-filter" type="search" placeholder="例如 leaf、user、arrow"><div class="grid icons">${Object.entries(registry.paths).map(([name,body])=>`<div class="panel icon" data-icon="${name}">${svg(registry,body)}<code>${name}</code></div>`).join('')}</div><p>viewBox 24 × 24，统一 1.8 描边，currentColor。16 / 20 / 24px 为常用视觉尺寸，点击区域独立满足 44px；装饰图标隐藏于读屏，纯图标按钮由按钮提供名称。</p></section>
<footer><p>修改依据：现有项目品牌、UI/UX Pro Max 检索与 WCAG 2.2。此目录自动生成，请勿手改。</p></footer>
</main><script>document.querySelectorAll('[data-feedback]').forEach(b=>b.addEventListener('click',()=>document.getElementById('feedback').textContent=b.dataset.feedback));document.getElementById('icon-filter').addEventListener('input',e=>document.querySelectorAll('[data-icon]').forEach(n=>n.hidden=!n.dataset.icon.toLowerCase().includes(e.target.value.trim().toLowerCase())));</script></body></html>\n`;
}
function outputs() {
  const tokens = load('tokens.json');
  const registry = load('icons.json');
  const css = renderTokens(tokens);
  const banner = '// 自动生成；修改 design-system/icons.json 后运行 node scripts/design-system.cjs\n';
  return {
    'web/src/css/tokens.css': css,
    'dashboard/src/core/styles/tokens.css': css,
    'dashboard/src/core/components/icons.generated.js': banner + `export const ICONS = ${JSON.stringify(registry.paths, null, 2)}\nexport const ICON_VIEWBOX = ${JSON.stringify(registry.viewBox)}\nexport const ICON_STROKE = ${registry.strokeWidth}\nexport const ICON_FALLBACK = ${JSON.stringify(registry.fallback)}\n`,
    'web/scripts/icons.js': banner + 'const ICONS = ' + JSON.stringify(Object.fromEntries(Object.entries(registry.paths).map(([name,body])=>[name,svg(registry,body)])), null, 2) + ';\nmodule.exports = { ICONS };\n',
    'design-system/catalog.html': renderCatalog(tokens, registry),
  };
}
function sync(check = false) {
  const mismatches = [];
  for (const [relative, content] of Object.entries(outputs())) {
    const file = path.join(ROOT, relative);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== content) {
      if (check) mismatches.push(relative);
      else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); console.log('[设计同步] ' + relative); }
    }
  }
  return mismatches;
}
module.exports = { ROOT, load, cssValue, renderTokens, outputs, sync };
if (require.main === module) {
  const errors = sync(process.argv.includes('--check'));
  if (errors.length) { console.error('设计快照已漂移，请运行 node scripts/design-system.cjs\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('[设计系统] 快照一致');
}
