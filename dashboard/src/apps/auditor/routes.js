/**
 * 审计工作台路由（/auditor 区间）——本文件仅管辖审计应用，与其他角色完全独立。
 * 组件全部懒加载：用户进入审计工作台时才下载对应代码，其余角色（含管理后台）代码不会加载。
 */
import { placeholder } from '@/gateway/placeholder'

export default {
  path: '/auditor',
  meta: { role: 'auditor' },
  component: () => import('./AuditorShell.vue'),
  children: [
    { path: '', component: () => import('./pages/AuditorHome.vue'), meta: { title: '审计工作台' } },
    { path: 'intake-audit', ...placeholder('入库审计', '核查入库记录的完整性与真实性，比对农户提交与入库登记数据。') },
    { path: 'logs', ...placeholder('审计日志', '查看历史审计结论与系统操作留痕。') },
    { path: 'account', component: () => import('@/gateway/AccountPage.vue'), meta: { title: '我的' } },
  ],
}
