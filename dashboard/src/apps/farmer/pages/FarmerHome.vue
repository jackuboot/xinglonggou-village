<script setup>
/** 农户工作台首页：生产和服务提供（业务闭环的「产生」环节） */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const stats = [
  { icon: 'box', label: '我的农产', value: '—', hint: '即将上线' },
  { icon: 'spark', label: '我的服务', value: '—', hint: '即将上线' },
  { icon: 'bell', label: '待处理', value: '—', hint: '即将上线' },
]

const links = [
  { to: '/farmer/products', icon: 'box', title: '我的农产', desc: '登记与维护你生产的农产品' },
  { to: '/farmer/services', icon: 'spark', title: '我的服务', desc: '发布农事体验、代耕代种等服务' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.farmer"
    tagline="你在闭环中的角色：生产农产品、提供服务；核收由入库员记录，最终触达消费者。"
    :stats="stats"
    :links="links"
  />
</template>
