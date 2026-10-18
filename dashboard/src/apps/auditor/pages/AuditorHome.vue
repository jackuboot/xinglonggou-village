<script setup>
/** 审计员工作台首页：业务闭环的「核查」环节 */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const links = [
  { to: '/auditor/intake-audit', icon: 'doc', title: '入库审计', desc: '核查入库记录与农户提交数据的一致性' },
  { to: '/auditor/logs', icon: 'chart', title: '审计日志', desc: '查看历史审计结论与操作留痕' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.auditor"
    section="审计台"
    title="独立审计与数据核查"
    summary="你在闭环里负责「核查」：定期审计入库与提交记录，结论独立于农户和入库员的操作。"
    :links="links"
  />
</template>
