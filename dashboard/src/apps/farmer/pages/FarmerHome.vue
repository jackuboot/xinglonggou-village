<script setup>
/** 农户工作台首页：业务闭环的「产生」环节 */
import RoleHome from '@/core/components/RoleHome.vue'
import { ROLES } from '@/core/roles'

const links = [
  { to: '/farmer/products', icon: 'box', title: '我的农产', desc: '登记与维护你生产的农产品' },
  { to: '/farmer/services', icon: 'spark', title: '我的服务', desc: '发布农事体验、代耕代种等服务' },
]
</script>

<template>
  <RoleHome
    :role="ROLES.farmer"
    section="生产"
    title="生产与提供服务"
    summary="你在闭环里负责「产生」：种出来、做出来，再由入库员核收登记，最终送到消费者手上。"
    :links="links"
  />
</template>
