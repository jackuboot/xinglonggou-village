# 02 · 数字工作台（dashboard/）

> 职责范围：`dashboard/src/`（网关、核心层、五角色应用、路由）。

## 定位与技术栈

多角色数字化工作台。Vue 3 + vue-router（**hash 模式**，刻意选择——静态托管无需配置 SPA 404 回退，任意路径刷新直达）+ Vite + `@cloudbase/js-sdk`（腾讯云 CloudBase）。

## 三层结构

```
src/
├── gateway/    网关层：登录、选择工作台、无权限提示、账号页（所有角色共用流程）
├── core/       核心层：CloudBase 初始化、角色模型、数据访问、公共组件/composable
└── apps/<role>/ 角色应用层：farmer / keeper / consumer / auditor / admin 五区
    每区独立 Shell + pages + routes.js，互不引用
```

**核心层关键文件**：`cloudbase.js`（SDK 封装）、`config.js`（全站唯一配置点：环境 ID、官网地址、品牌信息）、`roles.js`（角色唯一数据源）、`db.js`（当前用户授权读取，走云函数 `roles-admin` 的 `me` action）、`composables/useAuth.js`（登录态）、`useToast.js`、公共组件（StatCard / EmptyState / Icon / RoleHome）。

## 路由与懒加载（src/router.js）

- `router.js` 只做「组合」：公共流程页（`/login`、`/select`、`/no-access`）+ 五个角色分区路由，各区路由独立维护在 `src/apps/<角色>/routes.js`。
- **按区懒加载**：所有页面均为动态 `import()`，Vite 自动按区分包。用户进入哪个工作台只下载哪个工作台的代码；普通角色浏览器永远不会加载管理后台代码。
- 登录守卫：未登录一律跳 `/login`；等待登录态与角色恢复各设 3 秒上限（避免误踢与死等）；已登录访问 public 页时重定向到 `/select`（含自指重定向兜底）。
- 越权防护双保险：路由守卫校验 `meta.role` / `meta.adminOnly` + 云函数服务端鉴权。

## 各角色分区页面（当前实际路由）

| 分区 | 首页 | 子页面 | 状态 |
| --- | --- | --- | --- |
| `/farmer` 农户 | 我的生产 | products（我的农产）、services（我的服务）、account | 子页为占位页 |
| `/keeper` 入库员 | 入库工作台 | intake（农产品入库）、listing（代理发布）、account | 子页为占位页 |
| `/consumer` 消费者 | 逛村货 | orders（我的预约）、track（服务跟踪）、account | 子页为占位页 |
| `/auditor` 审计员 | 审计工作台 | intake-audit（入库审计）、logs（审计日志）、account | 子页为占位页 |
| `/admin` 管理后台（`meta.adminOnly`） | 管理总览 | users（用户授权管理，完整实现） | — |

MVP 阶段多数业务页为 `placeholder()` 占位页（`src/gateway/placeholder.js`），实现时替换对应路由组件即可，路由骨架不动。

## 登录与工作台选择流程

1. 未登录 → `/login`（LoginPage）。
2. 登录成功 → 统一进入 `/select`（选择工作台页；`defaultHome()` 对所有有效角色都返回 `/select`，支持一人多角色）。
3. 无任何有效角色的异常态回 `/login`；越权访问 → `/no-access`。

## 同步记录

- 2026-10-16 初始生成，基于 commit 6819374。
