/**
 * 入库员工作台路由（/keeper 区间）——本文件仅管辖入库应用，与其他角色完全独立。
 * 组件全部懒加载：用户进入入库工作台时才下载对应代码，其余角色（含管理后台）代码不会加载。
 */
import { placeholder } from '@/gateway/placeholder'

export default {
  path: '/keeper',
  meta: { role: 'keeper' },
  component: () => import('./KeeperShell.vue'),
  children: [
    { path: '', component: () => import('./pages/KeeperHome.vue'), meta: { title: '入库工作台' } },
    { path: 'intake', ...placeholder('农产品入库', '核收农户提交的农产品，登记品类、数量与质检信息后入库。') },
    { path: 'listing', ...placeholder('代理发布', '将入库农产与农户委托的服务代理发布到消费者端。') },
    { path: 'account', component: () => import('@/gateway/AccountPage.vue'), meta: { title: '我的' } },
  ],
}
