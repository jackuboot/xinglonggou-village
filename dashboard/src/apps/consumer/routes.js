/**
 * 消费者工作台路由（/consumer 区间）——本文件仅管辖消费者应用，与其他角色完全独立。
 * 组件全部懒加载：用户进入消费者工作台时才下载对应代码，其余角色（含管理后台）代码不会加载。
 */
import { placeholder } from '@/gateway/placeholder'

export default {
  path: '/consumer',
  meta: { role: 'consumer' },
  component: () => import('./ConsumerShell.vue'),
  children: [
    { path: '', component: () => import('./pages/ConsumerHome.vue'), meta: { title: '逛村货' } },
    { path: 'orders', ...placeholder('我的预约', '查看你在本村预约的农产品与服务订单。') },
    { path: 'track', ...placeholder('服务跟踪', '跟踪已预约服务的履约进度与交付记录。') },
    { path: 'account', component: () => import('@/gateway/AccountPage.vue'), meta: { title: '我的' } },
  ],
}
