<script setup>
/** 越权访问提示页：当前账号无该工作台权限 */
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
    <div class="card box">
      <span class="ic"><Icon name="shield" :size="32" /></span>
      <h1>暂无访问权限</h1>
      <p>
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
.wrap { min-width: 0; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: var(--space-8) var(--space-4); background: var(--color-canvas); }
.box { width: min(30rem, 100%); min-width: 0; padding: var(--space-10) var(--space-6); text-align: center; overflow-wrap: anywhere; }
.ic { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--radius-lg); background: var(--color-accent-soft); color: var(--color-accent-ink); margin-bottom: var(--space-4); }
h1 { font-size: var(--text-2xl); font-weight: 700; line-height: 1.4; }
p { color: var(--color-text-muted); font-size: var(--text-base); margin-top: var(--space-3); line-height: 1.7; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
.btn { flex: 1 1 10rem; min-width: 0; min-height: var(--control-height); white-space: normal; }
button:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
@media (max-width: 480px) { .box { padding: var(--space-8) var(--space-5); } }
</style>
