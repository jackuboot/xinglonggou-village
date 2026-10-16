/**
 * 农户工作台路由（/farmer 区间）——本文件仅管辖农户应用，与其他角色完全独立。
 * 组件全部懒加载：用户进入农户工作台时才下载对应代码，其余角色（含管理后台）代码不会加载。
 */
import { placeholder } from '@/gateway/placeholder'

export default {
  path: '/farmer',
  meta: { role: 'farmer' },
  component: () => import('./FarmerShell.vue'),
  children: [
    { path: '', component: () => import('./pages/FarmerHome.vue'), meta: { title: '我的生产' } },
    { path: 'products', ...placeholder('我的农产', '登记与维护你生产的农产品，提交后由入库员核收入库。') },
    { path: 'services', ...placeholder('我的服务', '发布农事体验、代耕代种等服务，由入库员代理上架发布。') },
    { path: 'account', component: () => import('@/gateway/AccountPage.vue'), meta: { title: '我的' } },
  ],
}
