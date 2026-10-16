<script setup>
import { useToast } from '@/core/composables/useToast'
const { state } = useToast()
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <div class="toast" :class="{ show: state.show }" role="status">{{ state.msg }}</div>
</template>
