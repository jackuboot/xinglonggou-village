<script setup>
/** 入库员工作台首页：业务闭环的「记录」环节 */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const links = [
  { to: '/keeper/intake', icon: 'inbox', title: '农产品入库', desc: '核收农户提交的农产品并登记入库' },
  { to: '/keeper/listing', icon: 'send', title: '代理发布', desc: '将入库农产与委托服务发布给消费者' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.keeper"
    section="入库台"
    title="核收、入库与代理发布"
    summary="你在闭环里负责「记录」：核收农户提交的农产并登记入库，再代理发布给消费者；记录是否真实完整，由审计员定期核查。"
    :links="links"
  />
</template>
