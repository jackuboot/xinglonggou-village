<script setup>
/** 登录后的选择工作台页：展示全部可用身份，选择进入对应工作台 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, logout } = useAuth()
const workspaces = computed(() => availableWorkspaces(state.roles))
const loggingOut = ref(false)

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
  <main class="select">
    <header class="head">
      <span class="eyebrow">{{ BRAND.name }}{{ BRAND.product }}</span>
      <h1>选择工作台</h1>
      <p>{{ workspaces.length > 1 ? '你拥有多个身份，选择以哪个进入' : '已为你开通以下工作台' }}</p>
    </header>
    <nav class="cards" aria-label="可用工作台">
      <router-link v-for="w in workspaces" :key="w.id" :to="w.home" class="card role-card" :data-role="w.id">
        <span class="role-ic"><Icon :name="w.icon" :size="28" /></span>
        <strong>{{ w.name }}</strong>
        <small>{{ w.desc }}</small>
        <span class="role-enter">进入工作台<Icon name="arrowRight" :size="16" /></span>
      </router-link>
    </nav>
    <div class="foot-actions">
      <a class="btn btn-ghost" :href="SITE_URL">返回官网</a>
      <button type="button" class="btn btn-ghost" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">
        <Icon name="logout" :size="20" />{{ loggingOut ? '退出中…' : '退出登录' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.select { min-height: 100vh; min-height: 100dvh; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-8); padding: var(--space-10) var(--space-4); background: var(--color-canvas); overflow-wrap: anywhere; }
.head { max-width: 42rem; text-align: center; }
.eyebrow { color: var(--color-primary); font-size: var(--text-sm); font-weight: 600; }
.head h1 { font-size: var(--text-3xl); font-weight: 700; line-height: 1.4; margin-top: var(--space-2); }
.head p { color: var(--color-text-muted); font-size: var(--text-base); margin-top: var(--space-2); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 16rem)); gap: var(--space-4); justify-content: center; width: 100%; max-width: var(--layout-content); min-width: 0; }
.role-card { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-7) var(--space-5) var(--space-5); text-align: center; border-top: 3px solid var(--role-accent); transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard); }
.role-card:hover { border-color: var(--role-accent); box-shadow: var(--shadow-md); }
.role-card:active { background: var(--role-accent-soft); }
.role-ic { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--role-accent-soft); color: var(--role-accent-ink); margin-bottom: var(--space-2); flex: none; }
.role-card strong { font-size: var(--text-lg); }
.role-card small { color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.7; flex: 1; }
.role-enter { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-2); margin-top: var(--space-4); color: var(--role-accent-ink); font-size: var(--text-sm); font-weight: 600; }
.role-enter svg { flex: none; }
.foot-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); max-width: 100%; }
.foot-actions .btn { min-height: var(--control-height); white-space: normal; min-width: 0; }
:is(a, button):focus-visible { outline: 3px solid var(--color-focus); outline-offset: 4px; }
@media (prefers-reduced-motion: reduce) { .role-card { transition: none; } }
</style>
