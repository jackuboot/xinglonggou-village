/**
 * 管理后台路由（/admin 区间）——本文件仅管辖管理应用，全部管理相关代码（页面 + 接口封装）都在本目录内。
 * 组件全部懒加载：仅拥有 admin 权限的账号进入管理后台时才下载对应代码，
 * 普通角色的浏览器永远不会加载管理后台代码（双保险：路由守卫校验 meta.adminOnly + 云函数服务端鉴权）。
 */
export default {
  path: '/admin',
  meta: { adminOnly: true },
  component: () => import('./AdminShell.vue'),
  children: [
    { path: '', component: () => import('./pages/AdminHome.vue'), meta: { title: '管理总览' } },
    { path: 'users', component: () => import('./pages/AdminUsersPage.vue'), meta: { title: '用户授权管理' } },
  ],
}
