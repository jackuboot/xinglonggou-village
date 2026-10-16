<script setup>
/** 通用占位页：按当前路由 meta.title / meta.hint 渲染「功能建设中」空状态 */
import { useRoute } from 'vue-router'
import EmptyState from '@/core/components/EmptyState.vue'

const route = useRoute()
</script>

<template>
  <div class="page">
    <EmptyState :icon="route.meta.icon || 'spark'" :title="route.meta.title" :desc="route.meta.hint" />
  </div>
</template>
