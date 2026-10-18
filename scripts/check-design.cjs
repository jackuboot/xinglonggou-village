#!/usr/bin/env node
/** 零依赖设计门禁：生成快照、颜色与变量、图标、断点、可读性和关键结构。 */
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, load, sync } = require('./design-system.cjs');
const layers = ['primitive', 'semantic', 'component', 'aliases'];
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
const variables = text => [...text.matchAll(/var\(\s*--([\w-]+)/g)].map(m => m[1]);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function resolveToken(name, tokens, overrides = {}, stack = []) {
  if (stack.includes(name)) throw new Error('变量循环：' + [...stack, name].join(' → '));
  const values = Object.assign({}, ...layers.map(layer => tokens[layer]), overrides);
  if (!(name in values)) throw new Error('未定义变量：' + name);
  const value = values[name];
  return value.replace(/\{([\w-]+)\}|var\(--([\w-]+)\)/g, (_, a, b) => resolveToken(a || b, tokens, overrides, [...stack, name]));
}
function contrast(a, b) {
  function luminance(hex) {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('对比度仅接受不透明六位色：' + hex);
    const [r, g, blue] = hex.slice(1).match(/../g).map(v => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + blue * 0.0722;
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function auditCss(css, { defined, breakpoints, primitives = new Set() }) {
  const errors = [];
  const text = stripComments(css);
  for (const m of text.matchAll(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/gi)) errors.push('原始颜色：' + m[0]);
  for (const m of text.matchAll(/(?:^|[;{])\s*(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:[^;{}]*\b(white|black|red|green|blue|gray|grey|gold|orange)\b/gi)) errors.push('具名原始颜色：' + m[1]);
  for (const name of variables(text)) {
    if (!defined.has(name)) errors.push('未定义变量：--' + name);
    if (primitives.has(name) && !/^(?:space-|text-|radius-|duration-|ease-|shadow-|font-)/.test(name)) errors.push('组件直接使用原始色板：--' + name);
  }
  for (const m of text.matchAll(/(?:min|max)-width\s*:\s*([\d.]+)px\s*\)/g)) if (!breakpoints.includes(Number(m[1]))) errors.push('未登记断点：' + m[1] + 'px');
  for (const m of text.matchAll(/font-size\s*:\s*([\d.]+)px\b/g)) if (Number(m[1]) < 12) errors.push('字号小于12px：' + m[1]);
  if (/transition\s*:\s*all\b/.test(text)) errors.push('禁止 transition: all');
  if (/outline\s*:\s*(?:none|0)(?:\s|;|})/.test(text)) errors.push('禁止无条件移除焦点轮廓');
  return [...new Set(errors)];
}
function run() {
  const tokens = load('tokens.json');
  const icons = load('icons.json');
  const errors = sync(true).map(file => '生成文件不一致：' + file);
  const values = Object.assign({}, ...layers.map(layer => tokens[layer]));
  for (const name of Object.keys(values)) {
    try { resolveToken(name, tokens); } catch (e) { errors.push(e.message); }
  }
  const pairs = tokens.contrastPairs.map(([fg, bg, min]) => ({ label: `${fg}/${bg}`, fg, bg, min, theme: {} }));
  const ratios = [];
  for (const pair of pairs) {
    try {
      const ratio = contrast(resolveToken(pair.fg, tokens, pair.theme), resolveToken(pair.bg, tokens, pair.theme));
      ratios.push({ pair: pair.label, ratio: Number(ratio.toFixed(2)), minimum: pair.min });
      if (ratio < pair.min) errors.push(`对比度不足：${pair.label} ${ratio.toFixed(2)} < ${pair.min}`);
    } catch(e) { errors.push(e.message); }
  }
  const sources = ['web/src', 'dashboard/src'].flatMap(dir => walk(path.join(ROOT, dir))).filter(file => /\.(css|vue|js|html)$/.test(file) && !/(?:tokens\.css|icons\.generated\.js)$/.test(file));
  const defined = new Set(Object.keys(values));
  const cssParts = new Map();
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    const css = file.endsWith('.css') ? text : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const inline = [...text.matchAll(/\sstyle="([^"]*)"/g)].map(m => m[1]).join(';');
    cssParts.set(file, css + '\n' + inline);
    for (const m of stripComments(css).matchAll(/--([\w-]+)\s*:/g)) defined.add(m[1]);
  }
  const primitives = new Set(Object.keys(tokens.primitive));
  for (const file of sources) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    for (const error of auditCss(cssParts.get(file), { defined, breakpoints: tokens.breakpoints, primitives })) errors.push(`${relative}: ${error}`);
    if (file.endsWith('.vue') && !file.endsWith('Icon.vue') && /<svg\b/.test(text)) errors.push(`${relative}: 功能图标须使用 Icon 组件`);
    // © / ® / ™ 是正常版权文字，不能因属于 Extended_Pictographic 而误报。
    if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(stripComments(text))) errors.push(`${relative}: 不要使用 emoji 作为界面图标`);
    const references = [...text.matchAll(/<Icon\b[^>]*\sname="([\w-]+)"/g), ...text.matchAll(/\bicon:\s*['"]([\w-]+)['"]/g), ...text.matchAll(/uiIcons\.([\w]+)/g)];
    for (const m of references) if (!icons.paths[m[1]]) errors.push(`${relative}: 未登记图标 ${m[1]}`);
  }
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/content/site.json'), 'utf8'));
  for (const entry of [...site.products, ...site.about.features]) if (!icons.paths[entry.icon]) errors.push('官网内容使用未登记图标：' + entry.icon);
  const template = fs.readFileSync(path.join(ROOT, 'web/src/index.html'), 'utf8');
  for (const [, key] of template.matchAll(/\{\{ui\.([\w]+)\}\}/g)) {
    if (typeof site.ui?.[key] !== 'string' || !site.ui[key].trim()) errors.push('官网交互文案缺失：ui.' + key);
  }
  const names = Object.keys(icons.paths);
  if (!names.includes(icons.fallback)) errors.push('图标回退名未登记');
  for (const [name, body] of Object.entries(icons.paths)) {
    if (/<(?:script|foreignObject|image|use)\b|\bon\w+=|\b(?:href|style|stroke-width)=|#[\da-f]{3,8}\b/i.test(body)) errors.push(`图标 ${name} 包含不允许的属性或内容`);
  }
  for (const role of tokens.roles) {
    const shell = sources.find(file => file.endsWith(`${role[0].toUpperCase() + role.slice(1)}Shell.vue`));
    if (!shell) { errors.push(`缺少 ${role} Shell`); continue; }
    const text = fs.readFileSync(shell, 'utf8');
    if (!text.includes('workspace.css') || !text.includes(`data-role="${role}"`)) errors.push(`${role} 未使用共享布局/主题`);
  }
  for (const file of ['web/src/css/style.css', 'dashboard/src/core/styles/base.css']) {
    if (!fs.readFileSync(path.join(ROOT, file), 'utf8').includes("'./tokens.css'")) errors.push(`${file} 未加载设计快照`);
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: !errors.length, checkedFiles: sources.length, icons: names.length, ratios, errors }, null, 2));
  else {
    console.log(`[设计门禁] ${sources.length} 源文件 / ${Object.keys(values).length} 变量 / ${names.length} 图标 / ${ratios.length} 对比度组合`);
    if (errors.length) console.error(errors.map(e => ' - ' + e).join('\n'));
    else console.log('[通过] 快照、颜色、变量、图标、断点与组件结构一致');
  }
  return errors;
}
module.exports = { auditCss, resolveToken, contrast, run };
if (require.main === module) { try { if (run().length) process.exitCode = 1; } catch(e) { console.error(e.message); process.exitCode = 1; } }
