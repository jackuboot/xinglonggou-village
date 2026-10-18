<script setup>
/** 消费者工作台首页：业务闭环的「使用」环节 */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const links = [
  { to: '/consumer/orders', icon: 'receipt', title: '我的预约', desc: '查看你预约的农产与服务订单' },
  { to: '/consumer/track', icon: 'chart', title: '服务跟踪', desc: '跟踪履约进度与交付记录' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.consumer"
    section="逛村货"
    title="预约与跟踪农产服务"
    summary="你在闭环里负责「使用」：预约本村的农产与服务，并全程跟踪履约与交付。"
    :links="links"
  />
</template>
