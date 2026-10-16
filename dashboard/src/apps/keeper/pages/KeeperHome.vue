<script setup>
/** 入库员工作台首页：农产品入库与代理发布（业务闭环的「记录」环节） */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const stats = [
  { icon: 'inbox', label: '待入库', value: '—', hint: '农户提交后在此处理' },
  { icon: 'box', label: '在库农产', value: '—', hint: '核收入库后统计' },
  { icon: 'send', label: '代理发布', value: '—', hint: '发布到消费者端' },
]

const links = [
  { to: '/keeper/intake', icon: 'inbox', title: '农产品入库', desc: '核收农户提交的农产品并登记入库' },
  { to: '/keeper/listing', icon: 'send', title: '代理发布', desc: '将入库农产与委托服务发布给消费者' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.keeper"
    tagline="你在闭环中的角色：核收农户提交、登记入库、代理发布——记录是否真实完整，由审计员定期核查。"
    :stats="stats"
    :links="links"
  />
</template>
