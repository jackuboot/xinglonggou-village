<script setup>
/**
 * 登录后的选择工作台页：列出全部可用身份，选择后进入对应工作台。
 * 用细线行代替卡片网格：身份数量增减时不会出现孤零零的落单卡片；
 * 权限与退出逻辑不变，仅调整版式。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, maskPhone, phoneOf, logout } = useAuth()
const workspaces = computed(() => availableWorkspaces(state.roles))
const displayPhone = computed(() => maskPhone(phoneOf(state.user)) || '已登录')
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
    <div class="col">
      <p class="page-kicker">{{ BRAND.name }}{{ BRAND.product }}</p>
      <h1 class="page-title">选择工作台</h1>
      <p class="page-lead">{{ workspaces.length > 1 ? '你拥有多个身份，选择以哪个进入。' : '已为你开通以下工作台。' }}</p>

      <section class="page-section" aria-labelledby="ws-heading">
        <h2 id="ws-heading" class="section-label">可用身份</h2>
        <ul class="row-list">
          <li v-for="w in workspaces" :key="w.id">
            <router-link class="row-link role-entry" :to="w.home" :data-role="w.id">
              <span class="row-icon"><Icon :name="w.icon" :size="22" /></span>
              <span class="row-body">
                <strong>{{ w.name }}</strong>
                <small>{{ w.desc }}</small>
              </span>
              <span class="row-arrow" aria-hidden="true"><Icon name="arrowRight" :size="20" /></span>
            </router-link>
          </li>
        </ul>
      </section>

      <section class="page-section" aria-labelledby="acct-heading">
        <h2 id="acct-heading" class="section-label">当前账号</h2>
        <p class="account">{{ displayPhone }}</p>
        <p class="section-note">身份由管理员在「用户授权管理」中开通；需要新身份时，把这个账号的 UID 提供给管理员。</p>
      </section>

      <div class="foot-actions">
        <a class="back-site" :href="SITE_URL"><span class="back-arrow" aria-hidden="true"><Icon name="arrowRight" :size="16" /></span>返回 {{ BRAND.name }}官网</a>
        <button type="button" class="btn btn-ghost" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">
          <Icon name="logout" :size="20" />{{ loggingOut ? '退出中…' : '退出登录' }}
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.select { min-width: 0; min-height: 100vh; min-height: 100dvh; display: flex; justify-content: center; padding: clamp(var(--space-8), 6vw, var(--space-12)) var(--space-5); background: var(--color-canvas); overflow-wrap: anywhere; }
.col { width: min(34rem, 100%); min-width: 0; }
.account { margin-top: var(--space-3); font-size: var(--text-base); font-weight: 600; font-variant-numeric: tabular-nums; }
.foot-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); margin-top: var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--color-border); }
.back-site { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--control-height); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); }
.back-arrow { display: inline-flex; transform: rotate(180deg); }
.back-arrow svg { width: 16px; height: 16px; }
.foot-actions .btn { min-width: 0; white-space: normal; }
</style>
