#!/usr/bin/env node
/** 本地视觉/交互回归，无第三方测试依赖。Chrome/Edge + 已安装的 Vite。
 * 认证与管理API仅在此进程启动的测试服务器中替换为显式夹具，不改生产源、不连接云端。
 * node scripts/verify-design.mjs  (可设置 CHROME_PATH；结果输出 design-system/reports/)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from '../dashboard/node_modules/vite/dist/node/index.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'design-system/reports');
fs.mkdirSync(REPORTS, { recursive: true });
const chromePath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));
if (!chromePath) throw new Error('未找到 Chrome/Edge，请设置 CHROME_PATH');
const authFixture = `import { reactive } from 'vue';
const loggedIn = !new URLSearchParams(location.search).has('loggedOut');
const state = reactive({ready:true,loggedIn,rolesLoaded:true,user:{uid:'design-fixture-admin',phoneNumber:'+8618800000000'},roles:loggedIn?['farmer','keeper','consumer','auditor','admin']:[]});
export function useAuth(){return {state,phoneOf:u=>u?.phoneNumber||'',uidOf:u=>u?.uid||'',maskPhone:()=> '188****0000',friendlyError:e=>e.message,loadRoles:async()=>{},logout:async()=>{state.loggedIn=false;state.roles=[]},sendCode:async()=>{throw new Error('设计夹具：禁止发送真实短信')},login:async()=>{throw new Error('设计夹具：不执行真实登录')}}}`;
const apiFixture = `export async function fetchAdminStatus(){return {total:2,hasAdmin:true,isAdmin:true,firstRun:false,hasUid:true}}
export async function fetchUserList(){if(new URLSearchParams(location.search).has('empty'))return {users:[]};if(new URLSearchParams(location.search).has('error'))throw new Error('设计夹具：加载失败，请重试');return {users:[{uid:'design-fixture-admin',name:'设计验证样例管理员',roles:['admin'],updatedAt:'2026-10-16T00:00:00Z'},{uid:'design-fixture-user-with-a-deliberately-long-identifier-to-check-wrapping',name:'设计验证样例：用于检查长名称换行的农户',roles:['farmer','keeper','auditor'],updatedAt:'2026-10-16T00:00:00Z'}]}}
export async function grantUserRoles(){throw new Error('设计夹具：禁止写入授权')} export async function revokeUser(){throw new Error('设计夹具：禁止撤销授权')}`;
const fixturePlugin = { name: 'isolated-design-fixture', enforce: 'pre', transform(code, id) {
  const file = id.replace(/\\/g, '/').split('?')[0];
  if (file.endsWith('/core/composables/useAuth.js')) return {code:authFixture,map:null};
  if (file.endsWith('/apps/admin/api.js')) return {code:apiFixture,map:null};
}};
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
const web = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const base = path.join(ROOT, 'web/dist');
  const file = url.pathname === '/catalog.html' ? path.join(ROOT, 'design-system/catalog.html') : path.resolve(base, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!(file.startsWith(base + path.sep) || file === path.join(ROOT, 'design-system/catalog.html')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let vite, chrome, ws;
const profile = fs.mkdtempSync(path.join(REPORTS, '.chrome-'));
const report = { fixture: '所有工作台数据为本地模拟；禁止真实登录、短信和授权写入', startedAt: new Date().toISOString(), checks: [], screenshots: [], failures: [], externalRequests: [] };
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if(value) return value; await pause(80); }
  throw new Error('等待超时：' + label);
}
function assert(value, label) { report.checks.push({label,pass:!!value}); if(!value) report.failures.push(label); }
try {
  await new Promise((resolve,reject)=>web.listen(8180,'127.0.0.1',resolve).once('error',reject));
  vite = await createServer({root:path.join(ROOT,'dashboard'),configFile:path.join(ROOT,'dashboard/vite.config.js'),plugins:[fixturePlugin],server:{host:'127.0.0.1',port:5190,strictPort:true},logLevel:'warn'});
  await vite.listen();
  chrome = spawn(chromePath, ['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'], {stdio:'ignore'});
  let launchError;
  chrome.on('error', e => {launchError = e;});
  const port = await until(async()=>{if(launchError)throw launchError;const p=path.join(profile,'DevToolsActivePort');return fs.existsSync(p)?Number(fs.readFileSync(p,'utf8').split('\n')[0]):false;},'浏览器调试端口');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  let id=0;const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP超时：'+method))},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
  ws.onmessage = async event => {
    const m=JSON.parse(event.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
    if(m.method==='Fetch.requestPaused'){
      const url=m.params.request.url;
      const isLocal=/^(https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:)/.test(url);
      if(!isLocal)report.externalRequests.push(url);
      // 页面跳转或资源被替换时请求可能已被取消，此时 InterceptionId 失效，忽略即可。
      try {
        await (isLocal
          ? send('Fetch.continueRequest',{requestId:m.params.requestId})
          : send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}));
      } catch(e) { /* 已失效的拦截项，无需处理 */ }
    }
    if(m.method==='Runtime.exceptionThrown')report.failures.push('浏览器异常：'+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
  };
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const viewport=async(w,h)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  async function navigate(url, selector='main', role) {
    await send('Page.navigate',{url});
    await until(()=>evaluate(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading' && !!document.querySelector(${JSON.stringify(selector)})`).catch(()=>false),url);
    // 切角色时按需加载的外壳才会挂载；只等 main 会匹配到上一个角色的外壳，必须等 data-role。
    if(role)await until(()=>evaluate(`!!document.querySelector('.workspace[data-role="${role}"]')`),role+' 工作台就绪');
    await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
    await until(()=>evaluate(`!document.querySelector('[class*="-enter-active"], [class*="-leave-active"]')`),'路由过渡完成');
  }
  const roleOf = route => (route.match(/^\/(farmer|keeper|consumer|auditor|admin)\b/) || [])[1];
  async function layout(label) {
    const result=await evaluate(`(()=>{const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1 && !['svg','path'].includes(e.tagName.toLowerCase())}).slice(0,8).map(e=>e.tagName+'.'+e.className),smallButtons:[...document.querySelectorAll('button')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5}).map(e=>e.textContent.trim()||e.getAttribute('aria-label')),text:document.body.innerText.slice(0,80)}})()`);
    assert(result.scrollWidth<=result.width+1,`${label} 无页面横向溢出`);
    assert(result.smallButtons.length===0,`${label} 可见按钮至少44px`);
    report.checks.push({label:label+' 测量',...result});
  }
  async function screenshot(file) {const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(REPORTS,file),Buffer.from(r.data,'base64'));report.screenshots.push(file);}
  for (const [w,h] of [[320,800],[375,812],[768,1024],[900,800],[1024,768],[1440,960],[812,375]]) {
    await viewport(w,h);
    await navigate('http://127.0.0.1:8180/','main');await layout(`官网 ${w}×${h}`);
    if(w===375||w===1440)await screenshot(`web-${w}.png`);
  }
  await viewport(375,812);await navigate('http://127.0.0.1:8180/','main');
  await evaluate(`document.getElementById('navToggle').click()`);
  assert(await evaluate(`document.getElementById('navToggle').getAttribute('aria-expanded')==='true'`),'官网手机菜单可展开');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert(await evaluate(`document.getElementById('navToggle').getAttribute('aria-expanded')==='false' && document.activeElement.id==='navToggle'`),'Esc关闭菜单并返回焦点');
  await evaluate(`document.getElementById('navToggle').click()`);await viewport(1440,960);
  await until(()=>evaluate(`document.getElementById('navToggle').getAttribute('aria-expanded')==='false'`),'断点关闭菜单');
  assert(true,'官网断点切换复位菜单');
  assert(await evaluate(`!!document.getElementById('navToggle').getAttribute('aria-label') && !!document.querySelector('[data-copy]').textContent.trim() && !document.body.innerHTML.includes('{{ui.')`),'官网交互文案完整');
  // 替换当前测试页面的剪贴板，验证反馈而不改用户剪贴板。
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(r=>{window.resolveTestCopy=r})}});document.querySelector('[data-copy]').click()`);
  assert(await evaluate(`document.querySelector('[data-copy]').getAttribute('aria-busy')==='true'`),'复制显示忙状态');
  await evaluate(`window.resolveTestCopy()`);
  await until(()=>evaluate(`document.getElementById('toast').innerText.startsWith('已复制：')`),'复制成功提示');
  assert(true,'模拟复制成功有读屏提示');
  await evaluate(`navigator.clipboard.writeText=()=>Promise.reject(new Error('模拟拒绝'));document.querySelector('[data-copy]').click()`);
  await until(()=>evaluate(`document.getElementById('toast').innerText.startsWith('复制未完成')`),'复制失败提示');
  assert(true,'模拟复制失败保留手工记录路径');
  for(const [w,h] of [[375,812],[1440,960]]) {
    await viewport(w,h);await navigate('http://127.0.0.1:8180/','main');
    await evaluate(`document.documentElement.style.fontSize='200%'`);await layout(`官网200%文字 ${w}px`);
  }
  const routes=['/login','/select','/farmer','/keeper','/consumer','/auditor','/admin','/admin/users','/farmer/account','/farmer/products'];
  for(const [w,h] of [[320,800],[375,812],[768,1024],[1024,768],[1440,960],[812,375]]) {
    await viewport(w,h);
    for(const route of routes){
      const url=`http://127.0.0.1:5190/${route==='/login'?'?loggedOut=1':''}#${route}`;
      await navigate(url,route==='/login'?'#phone':route==='/select'?'.role-entry':'.workspace main',roleOf(route));
      if(route==='/admin/users')await until(()=>evaluate(`document.body.innerText.includes('design-fixture-user-with')`),'用户列表夹具');
      await layout(`工作台夹具 ${route} ${w}×${h}`);
      if((w===375&&['/login','/admin/users','/select'].includes(route))||(w===1440&&route==='/farmer'))await screenshot(`fixture-${route.replaceAll('/','-').slice(1)}-${w}.png`);
    }
  }
  await viewport(375,812);
  for(const route of ['/farmer/services','/keeper/intake','/keeper/listing','/keeper/account','/consumer/orders','/consumer/track','/consumer/account','/auditor/intake-audit','/auditor/logs','/auditor/account']){
    await navigate(`http://127.0.0.1:5190/#${route}`,'.workspace main');await layout(`剩余路由夹具 ${route} 375px`);
  }
  // 角色首页：闭环高亮落在当前角色、功能行保持 44px 且不横向溢出
  const roleNames = { farmer: '农户', keeper: '入库员', consumer: '消费者', auditor: '审计员' };
  for (const [role, name] of Object.entries(roleNames)) {
    for (const width of [1440, 375]) {
      await viewport(width, width < 600 ? 812 : 960);
      await navigate(`http://127.0.0.1:5190/#/${role}`, '.workspace main', role);
      const info = await evaluate(`(()=>{const on=[...document.querySelectorAll('.chain-item.on')];
        return {onCount:on.length,onText:on.map(e=>e.innerText).join(' '),
          rows:[...document.querySelectorAll('.row-link')].filter(e=>e.getBoundingClientRect().height>0).map(e=>Math.round(e.getBoundingClientRect().height)),
          tags:[...document.querySelectorAll('.row-tag')].length,
          docW:document.documentElement.scrollWidth,win:innerWidth}})()`);
      assert(info.onCount === 1 && info.onText.includes(name), `${name}工作台 闭环高亮落在本角色`);
      assert(info.rows.length > 0 && info.rows.every(h => h >= 43.5), `${name}工作台 功能行至少44px`);
      assert(info.tags === info.rows.length, `${name}工作台 每个入口都标注了上线状态`);
      assert(info.docW <= info.win + 1, `${name}工作台 ${width}px 无页内横向溢出`);
    }
  }
  // 账号页、占位页与无权限页：结构存在、按钮达标、无页内横向溢出
  await viewport(1440, 960);
  await navigate('http://127.0.0.1:5190/#/farmer/account', '.uid-row', 'farmer');
  assert(await evaluate(`!!(document.querySelector('.uid-row code')||{}).textContent`), '账号页显示用户 UID');
  assert(await evaluate(`!!document.querySelector('.id-chips') && document.querySelectorAll('.id-chips li').length > 0`), '账号页显示已开通身份');
  for (const [route, sel] of [['/farmer/account', '.uid-row'], ['/farmer/products', '.empty'], ['/no-access', '.wrap']]) {
    for (const width of [1440, 375]) {
      await viewport(width, width < 600 ? 812 : 960);
      await navigate(`http://127.0.0.1:5190/#${route}`, sel, roleOf(route));
      await layout(`${route} ${width}px`);
    }
  }
  // 顶栏不重复工作台名：宽屏显示当前分区，窄屏（侧栏隐藏）回退显示工作台名
  for (const [width, expectDesk, expectPhone] of [[1440, '生产', ''], [375, '', '农户工作台']]) {
    await viewport(width, width < 600 ? 812 : 960);
    await navigate('http://127.0.0.1:5190/#/farmer', '.workspace main', 'farmer');
    const top = await evaluate(`(()=>{const vis=e=>!!e&&getComputedStyle(e).display!=='none';
      const d=document.querySelector('.tb-desk'), p=document.querySelector('.tb-phone');
      return {desk:vis(d)?d.textContent.trim():'', phone:vis(p)?p.textContent.trim():'',
        mark:vis(document.querySelector('.topbar-brand .brand-mark')),
        sideTitle:(document.querySelector('.sidebar .brand-text strong')||{}).textContent||''}})()`);
    assert(top.desk === expectDesk && top.phone === expectPhone, `${width}px 顶栏标题按断点切换（桌面分区 / 窄屏工作台名）`);
    assert(!(top.desk && top.phone), `${width}px 顶栏不会同时出现工作台名与分区名`);
    if (width >= 900) assert(!top.mark && top.sideTitle === '农户工作台', '宽屏工作台名只在侧栏出现一次');
    else assert(top.mark, '窄屏侧栏隐藏时顶栏保留角色标识');
  }
  // 选中态不使用内嵌条纹：内嵌 box-shadow 会跟着圆角弯折，看起来像渲染错位
  await viewport(375, 812);
  for (const role of ['farmer', 'admin']) {
    await navigate(`http://127.0.0.1:5190/#/${role}`, '.workspace main', role);
    assert(await evaluate(`(()=>{const el=document.querySelector('.tab-item.active');return !!el && getComputedStyle(el).boxShadow==='none'})()`), `${role} 底部导航选中态不使用内嵌条纹`);
  }
  await viewport(1440, 960);
  await navigate('http://127.0.0.1:5190/#/farmer', '.workspace main', 'farmer');
  assert(await evaluate(`getComputedStyle(document.querySelector('.side-item.active')).boxShadow==='none'`), '侧栏选中态不使用内嵌条纹');
  // 侧栏副标题不把中文词从中间劈开，也不溢出侧栏
  assert(await evaluate(`(()=>{const el=[...document.querySelectorAll('.brand-text small')].find(e=>e.textContent.includes('生产与农事服务'));
    if(!el)return false;
    return getComputedStyle(el).wordBreak==='keep-all' && el.scrollWidth<=el.clientWidth+1})()`), '侧栏中文副标题不劈开词且不溢出');
  for(const mode of ['empty','error']){
    await navigate(`http://127.0.0.1:5190/?${mode}=1#/admin/users`,'.workspace main');
    await until(()=>evaluate(`document.body.innerText.includes(${JSON.stringify(mode==='error'?'设计夹具：加载失败':'暂无')})`),mode+'状态');
    await layout(`授权列表${mode}状态375px`);
  }
  for(const role of ['farmer','keeper','consumer','auditor','admin']) {
    await navigate(`http://127.0.0.1:5190/#/${role}`,'.workspace main',role);
    assert(await evaluate(`(()=>{const hash=location.hash;document.querySelector('.skip-link').click();return location.hash===hash&&document.activeElement===document.querySelector('main')})()`),`${role} 跳至正文聚焦且不破坏hash路由`);
  }
  await until(()=>evaluate(`!!document.querySelector('.tabbar a[href$="/admin/users"]')`),'管理后台底部导航');
  await evaluate(`document.querySelector('.tabbar a[href$="/admin/users"]').click()`);
  await until(()=>evaluate(`location.hash==='#/admin/users' && !!document.querySelector('#grant-uid') && document.activeElement===document.querySelector('main')`),'子路由正文焦点');
  assert(true,'子路由导航完成后焦点进入正文');
  await until(()=>evaluate(`document.querySelectorAll('.users .user').length===2`),'编辑用户夹具');
  await evaluate(`document.querySelectorAll('.users .user')[1].querySelector('button').click()`);
  await until(()=>evaluate(`document.getElementById('grant-uid').value.includes('deliberately-long')`),'回填表单');
  assert(await evaluate(`document.activeElement.id==='grant-uid'`),'编辑用户仅回填表单并聚焦UID（未保存）');
  assert(await evaluate(`(()=>{const value=document.getElementById('grant-uid').value;document.querySelector('.skip-link').click();return location.hash==='#/admin/users'&&document.getElementById('grant-uid').value===value})()`),'跳过导航保留未保存授权表单');
  await navigate('http://127.0.0.1:5190/?loggedOut=1#/login','#phone');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate(`document.getElementById('phone').focus()`);
  await send('Input.insertText',{text:'123'});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await until(()=>evaluate(`document.getElementById('phone').getAttribute('aria-invalid')==='true'`),'手机号blur校验');
  assert(true,'手机号真实输入/Tab校验与aria-invalid同步（未发送短信）');
  await navigate('http://127.0.0.1:5190/#/admin','.workspace main');
  await evaluate(`document.querySelector('.topbar button[aria-label*="退出"], .topbar button:last-child')?.focus()`);
  assert(await evaluate(`!![...document.querySelectorAll('.topbar button,.topbar a')].find(e=>e.innerText.includes('切换')||e.getAttribute('aria-label')?.includes('切换'))`),'手机管理员可达身份切换');
  await evaluate(`document.documentElement.style.fontSize='200%'`);await layout('手机管理员200%文字');
  await evaluate(`[...document.querySelectorAll('.mobile-account button')].find(e=>e.innerText.includes('切换')).click()`);
  await until(()=>evaluate(`location.hash==='#/select'&&!!document.querySelector('.role-entry')`),'手机切换工作台');
  assert(true,'手机管理员身份切换按钮可实际进入选择页');
  for(const [w,h,section] of [[375,812,'industry'],[1440,960,'contact']]) {
    await viewport(w,h);await navigate('http://127.0.0.1:8180/','main');
    await evaluate(`document.getElementById(${JSON.stringify(section)}).scrollIntoView()`);
    await screenshot(`web-${section}-${w}.png`);
  }
  await navigate('http://127.0.0.1:8180/catalog.html','main');
  await screenshot('catalog-1440.png');
  await evaluate(`const e=document.querySelector('#icon-filter');e.value='leaf';e.dispatchEvent(new Event('input',{bubbles:true}))`);
  assert(await evaluate(`document.querySelectorAll('[data-icon]:not([hidden])').length===1`),'设计样本图标筛选可用');
  assert(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`),'减少动态效果模式验证');
  assert(report.externalRequests.length===0,'夹具和官网不请求外部服务');
} catch(e) {report.failures.push(e.stack||String(e));console.error(e.message);}
finally {
  if(ws)ws.close();if(chrome)chrome.kill();if(vite)await vite.close();await new Promise(r=>web.close(r));
  report.finishedAt=new Date().toISOString();report.ok=!report.failures.length;
  fs.writeFileSync(path.join(REPORTS,'browser-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failures:report.failures,screenshots:report.screenshots},null,2));
  if(!report.ok)process.exitCode=1;
}
