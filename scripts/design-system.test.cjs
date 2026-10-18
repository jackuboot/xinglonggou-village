const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditCss, contrast, resolveToken } = require('./check-design.cjs');
const { load, outputs, renderTokens } = require('./design-system.cjs');
const options = { defined: new Set(['color-primary', 'space-4', 'green-700']), breakpoints: [560, 899, 900, 1024], primitives: new Set(['green-700', 'space-4']) };
test('语义变量和已登记断点允许通过', () => {
  assert.deepEqual(auditCss('.btn { color: var(--color-primary); padding: var(--space-4) } @media(max-width:899px) { .x {display:none} }', options), []);
});
test('新增十六进制、rgb、hsl与具名颜色会失败', () => {
  for (const css of ['color:#abcdef;', 'background:rgb(1, 2, 3);', 'color:hsl(0 0% 0%);', 'color: white;']) {
    assert.ok(auditCss('.x{' + css + '}', options).some(x => x.includes('颜色')));
  }
});
test('未知变量、直接原始色板和未登记断点会失败', () => {
  assert.ok(auditCss('.x {color:var(--missing)}', options).some(x => x.includes('未定义')));
  assert.ok(auditCss('.x {color:var(--green-700)}', options).some(x => x.includes('原始色板')));
  assert.ok(auditCss('@media(max-width:777px) {}', options).some(x => x.includes('断点')));
});
test('小字号与移除焦点会失败，注释不误判', () => {
  assert.ok(auditCss('.x{font-size:11px;outline:none}', options).length >= 2);
  assert.deepEqual(auditCss('/* color:#fff; */ .x{color:var(--color-primary)}', options), []);
});
test('WCAG 对比度计算正确', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
  assert.ok(contrast('#2f6b4f', '#ffffff') >= 4.5);
  assert.ok(contrast('#d9a441', '#ffffff') < 3);
});
test('Token引用循环和缺失会失败', () => {
  const tokens = { primitive: {}, semantic: { a: '{b}', b: '{a}' }, component: {}, aliases: {} };
  assert.throws(() => resolveToken('a', tokens), /循环/);
  tokens.semantic.b = '{missing}';
  assert.throws(() => resolveToken('a', tokens), /未定义/);
});
test('两端快照一致，角色共用同一套颜色', () => {
  const generated = outputs();
  assert.equal(generated['web/src/css/tokens.css'], generated['dashboard/src/core/styles/tokens.css']);
  assert.equal(resolveToken('brand', load('tokens.json')), '#2f6b4f');
  const tokens = load('tokens.json');
  // 五个工作台不再各自配色：--role-* 只解析到组件层的统一值
  assert.equal(resolveToken('role-accent', tokens), '#2f6b4f');
  assert.equal(resolveToken('role-deep', tokens), '#173f2e');
  assert.equal(resolveToken('role-accent-ink', tokens), '#1f4d38');
  assert.equal(tokens.themes, undefined);
  assert.deepEqual(tokens.roles, ['farmer', 'keeper', 'consumer', 'auditor', 'admin']);
  assert.ok(!renderTokens(tokens).includes('[data-role='));
});
