/**
 * 路由：hash 模式（#/...）。
 * 好处：静态托管无需配置 SPA 404 回退，任意路径刷新都能直达。
 *
 * 结构：本文件只做「组合」——公共流程页（登录/选择/无权限）+ 五个角色的应用路由
 * （各自独立维护在 src/apps/<角色>/routes.js，互不引用）。
 *
 * 按区懒加载：所有页面组件均为动态 import()，Vite 自动按区分包——
 * 用户进入哪个工作台就只下载哪个工作台的代码；普通角色的浏览器永远不会加载
 * 管理后台（/admin）与其他角色的代码。
 *
 * 区间一览：
 *   /farmer   农户工作台（apps/farmer）     meta.role=farmer
 *   /keeper   入库员工作台（apps/keeper）   meta.role=keeper
 *   /consumer 消费者工作台（apps/consumer） meta.role=consumer
 *   /auditor  审计工作台（apps/auditor）    meta.role=auditor
 *   /admin    管理后台（apps/admin）        meta.adminOnly，需 admin 权限
 * 守卫按 meta.role / meta.adminOnly 校验；/select 为登录后统一入口；/no-access 为越权提示。
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '@/core/composables/useAuth'
import { BRAND } from '@/core/config'
import { defaultHome, hasAdminRole } from '@/core/roles'

import consumerRoutes from '@/apps/consumer/routes'
import farmerRoutes from '@/apps/farmer/routes'
import keeperRoutes from '@/apps/keeper/routes'
import auditorRoutes from '@/apps/auditor/routes'
import adminRoutes from '@/apps/admin/routes'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      // 登录态尚未恢复时先兜底到 /login，守卫会在 rolesLoaded 后自愈到正确入口
      redirect: () => {
        const { state } = useAuth()
        return state.loggedIn ? defaultHome(state.roles) : '/login'
      },
    },
    { path: '/login', component: () => import('@/gateway/LoginPage.vue'), meta: { public: true, title: '登录' } },
    { path: '/select', component: () => import('@/gateway/SelectRolePage.vue'), meta: { title: '选择工作台' } },
    { path: '/no-access', component: () => import('@/gateway/NoAccessPage.vue'), meta: { title: '暂无访问权限' } },

    farmerRoutes,
    keeperRoutes,
    consumerRoutes,
    auditorRoutes,
    adminRoutes,

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() { return { top: 0 } },
})

/** 登录与角色守卫：未登录一律 /login；分区校验 meta.role / meta.adminOnly */
router.beforeEach(async (to) => {
  const { state } = useAuth()
  // 等待 SDK 恢复本地登录态（最多 3 秒，避免误踢到登录页）
  const started = Date.now()
  while (!state.ready && Date.now() - started < 3000) {
    await new Promise(r => setTimeout(r, 50))
  }
  // 已登录时等待角色加载完成（loadRoles 有兜底必定完成；3 秒硬上限自保）
  const roleWait = Date.now()
  while (state.loggedIn && !state.rolesLoaded && Date.now() - roleWait < 3000) {
    await new Promise(r => setTimeout(r, 50))
  }

  if (to.meta.public) {
    if (!state.loggedIn) return true
    const home = defaultHome(state.roles)
    return home === to.path ? true : home // 异常兜底：避免自指重定向死循环
  }
  if (!state.loggedIn) return { path: '/login' }

  // 角色分区校验：访问链上任一 meta.role 不在有效角色中则拒绝
  const need = to.matched.find(r => r.meta && r.meta.role)
  if (need && !state.roles.includes(need.meta.role)) {
    return { path: '/no-access' }
  }
  // 管理后台校验：需要 admin 权限标识
  const needAdmin = to.matched.some(r => r.meta && r.meta.adminOnly)
  if (needAdmin && !hasAdminRole(state.roles)) {
    return { path: '/no-access' }
  }
  return true
})

router.afterEach((to) => {
  document.title = (to.meta.title ? to.meta.title + ' · ' : '') + BRAND.name + BRAND.product
})
