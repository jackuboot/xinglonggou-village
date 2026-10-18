<script setup>
/** 越权访问提示页：当前账号无该工作台权限。整页提示，不做浮起卡片。 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { defaultHome } from '@/core/roles'

const router = useRouter()
const { state, logout } = useAuth()
const loggingOut = ref(false)

function goHome() {
  router.replace(defaultHome(state.roles))
}

async function onLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await logout()
    await router.replace('/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <div class="col">
      <span class="mark"><Icon name="shield" :size="24" /></span>
      <h1 class="page-title">暂无访问权限</h1>
      <p class="page-lead">
        当前账号没有访问该工作台的权限。如需使用对应身份（农户 / 入库员 / 审计员），
        请联系管理员为你的账号开通授权。
      </p>
      <div class="actions">
        <button type="button" class="btn btn-primary" @click="goHome">返回选择工作台</button>
        <button type="button" class="btn btn-ghost" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">{{ loggingOut ? '退出中…' : '退出登录' }}</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.wrap { min-width: 0; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: var(--space-10) var(--space-5); background: var(--color-canvas); overflow-wrap: anywhere; }
.col { width: min(34rem, 100%); min-width: 0; }
.mark { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: var(--space-4); border-radius: var(--radius-md); background: var(--color-accent-soft); color: var(--color-accent-ink); }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--color-border); }
.actions .btn { flex: 1 1 10rem; min-width: 0; white-space: normal; }
</style>
