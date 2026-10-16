# 登录与授权流程证据索引（flow-evidence）

> 生成：2026-10-16 · 基于 commit 6819374 · 场景技能：`flow-visualizer`（时序图源：PlantUML）
> 覆盖：[login-auth-flow.puml](login-auth-flow.puml)（登录+角色加载+守卫）与 [admin-auth-flow.puml](admin-auth-flow.puml)（管理端授权+bootstrap）

## login-auth-flow.puml 逐段证据

| 时序段 | 步骤 | 证据（sourceRefs） |
| --- | --- | --- |
| 0 启动恢复 | 守卫等待 ready / rolesLoaded（各 ≤3 秒，50ms 轮询） | `dashboard/src/router.js:58-69` |
| 0 启动恢复 | hasLoginState() 同步读取；getCurrentUser() 刻意放在 SDK 回调链之外（规避 v3.10.2 事件环缺陷） | `dashboard/src/core/composables/useAuth.js:70-120`（注释含真实 Chrome 复现记录） |
| 0 启动恢复 | me 动作：readAll 全表 SELECT（LIMIT 200），表不存在（42P01）按空处理；只返回本人记录 | `dashboard/cloudfunctions/roles-admin/index.js:97-143` |
| 0 启动恢复 | getGrantedRoles 任何异常返回 [] | `dashboard/src/core/db.js:14-22` |
| 0 启动恢复 | effectiveRoles：授权角色 + 隐式 consumer，admin 置末 | `dashboard/src/core/roles.js:84-94` |
| 1 发送验证码 | 手机号 /^1[3-9]\d{9}$/ 校验、'+86' 前缀拼接、verificationInfo 保存、60 秒倒计时 | `dashboard/src/gateway/LoginPage.vue:21-50` |
| 1 发送验证码 | getVerification(phone_number)；失败经 friendlyError 翻译（短信未开通/超限/域名白名单等） | `dashboard/src/core/composables/useAuth.js:122-150` |
| 2 验证码登录 | signInWithSms（首次自动注册）→ refreshUser → me → effectiveRoles | `useAuth.js:152-161`、`LoginPage.vue:52-65` |
| 2 验证码登录 | 登录成功统一 router.replace(defaultHome(roles))；defaultHome 对所有有效角色返回 /select，无角色回 /login | `LoginPage.vue:58-59`、`roles.js:102-109` |
| 3 守卫与进入 | 守卫校验 meta.role / meta.adminOnly，越权 → /no-access；public 页已登录 → /select（含自指兜底） | `dashboard/src/router.js:71-88` |
| 3 守卫与进入 | 按区懒加载（动态 import()） | `router.js:42-50`、`src/apps/*/routes.js` |
| 3 守卫与进入 | 选择工作台页展示 availableWorkspaces 卡片、退出登录 | `dashboard/src/gateway/SelectRolePage.vue:13-18,29-42` |
| 4 退出 | signOut → state 重置 → /login | `useAuth.js:163-169`、`SelectRolePage.vue:15-18` |

## admin-auth-flow.puml 逐段证据

| 时序段 | 步骤 | 证据（sourceRefs） |
| --- | --- | --- |
| 进入后台 | adminOnly 守卫 + admin 分区懒加载 | `dashboard/src/apps/admin/routes.js:1-14`、`router.js:84-87` |
| 读取 | api.js 四个封装（status/list/grant/revoke），ok:false 抛业务错误 | `dashboard/src/apps/admin/api.js:10-37` |
| 读取/写入 | 身份只信 TCB_UUID（getCloudbaseContext），客户端传参不可信 | `cloudfunctions/roles-admin/index.js:125-132` |
| 写入 | admin 双重校验（调用者记录含 admin） | `index.js:194-198` |
| 写入 | GRANTABLE_ROLES 过滤；防自锁（自己 grant 必须保留 admin）；revoke 禁止自撤 | `index.js:24-25,210-247` |
| 写入 | ensureTable 幂等建表；esc() SQL 转义；INSERT/UPDATE/DELETE | `index.js:30-31,82-91,225-247` |
| bootstrap | 仅无用户上下文调用（uid 非空拒绝）；仅系统无 admin 时生效 | `index.js:159-171` |
| bootstrap | describeUserList 按手机号查 UID（须先登录过一次） | `index.js:173-184`、`scripts/set-super-admin.mjs:7-10` |
| bootstrap | CLI 子进程 tcb fn invoke；解析「返回结果」JSON | `dashboard/scripts/set-super-admin.mjs:54-59,22-51` |

## 证据边界

- CloudBase 身份验证的内部行为（短信下发、验证码校验、防刷、自动注册）为平台侧黑盒，仓库内仅有 SDK 调用点与错误翻译文案，时序图中以外部参与者表达。
- 「user_roles 未对 anon/authenticated 授权、前端无法直访」为代码注释声明（`db.js:1-6`、`index.js:4-6`），云端实际配置未验证。
- 时序图为静态代码推演的调用链，无线上 trace 佐证（项目无遥测）；运行时实际顺序以代码控制流为准。
