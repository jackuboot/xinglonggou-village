<script setup>
/** 审计员工作台首页：独立审计与数据核查（业务闭环的「审计」环节） */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const stats = [
  { icon: 'doc', label: '待审计', value: '—', hint: '即将上线' },
  { icon: 'shield', label: '本月审计', value: '—', hint: '即将上线' },
]

const links = [
  { to: '/auditor/intake-audit', icon: 'doc', title: '入库审计', desc: '核查入库记录与农户提交数据的一致性' },
  { to: '/auditor/logs', icon: 'chart', title: '审计日志', desc: '查看历史审计结论与操作留痕' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.auditor"
    tagline="你在闭环中的角色：对入库员和系统数据定期审计，保障记录真实可信。审计独立于业务，不受农户与入库员操作影响。"
    :stats="stats"
    :links="links"
  />
</template>
