<script setup>
/** 消费者工作台首页：预约、使用、跟踪（业务闭环的「使用」环节） */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const stats = [
  { icon: 'receipt', label: '我的预约', value: '—', hint: '预约后在此查看' },
  { icon: 'chart', label: '进行中', value: '—', hint: '已确认待履约' },
]

const links = [
  { to: '/consumer/orders', icon: 'receipt', title: '我的预约', desc: '查看你预约的农产与服务订单' },
  { to: '/consumer/track', icon: 'chart', title: '服务跟踪', desc: '跟踪履约进度与交付记录' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.consumer"
    tagline="你在闭环中的角色：预约、使用本村农产与服务，并全程跟踪履约与交付。"
    :stats="stats"
    :links="links"
  />
</template>
