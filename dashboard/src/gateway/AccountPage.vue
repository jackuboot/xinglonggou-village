<script setup>
/** 账号页：身份信息、用户 UID、切换身份与退出；不承载管理授权入口。 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { useToast } from '@/core/composables/useToast'
import { ROLES, availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, maskPhone, phoneOf, uidOf, logout } = useAuth()
const { toast } = useToast()

const displayPhone = maskPhone(phoneOf(state.user)) || '已登录'
const uid = computed(() => uidOf(state.user))
const myRoles = computed(() => state.roles.map(id => ROLES[id]).filter(Boolean))
const workspaces = computed(() => availableWorkspaces(state.roles))
const loggingOut = ref(false)

const INFO = [
  { label: '登录方式', value: '手机号 · 短信验证码' },
  { label: '账号说明', value: '首次验证登录后自动注册' },
  { label: '所属平台', value: `${BRAND.name}${BRAND.product}` },
]

async function copyUid() {
  if (!uid.value) return
  try {
    await navigator.clipboard.writeText(uid.value)
    toast('已复制用户 UID')
  } catch (e) {
    toast('复制失败，请手动选择文本复制')
  }
}

function goSelect() {
  router.push('/select')
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
  <div class="page account">
    <h1>我的账号</h1>
    <div class="card me">
      <span class="avatar"><Icon name="user" :size="28" /></span>
      <div class="me-info">
        <h2>{{ displayPhone }}</h2>
        <div class="me-chips" aria-label="已开通身份">
          <span v-for="r in myRoles" :key="r.id" class="chip" :data-role="r.id">
            <Icon :name="r.icon" :size="16" />{{ r.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="card list">
      <div class="row">
        <span class="row-label">用户 UID</span>
        <span class="row-value uid">
          <code>{{ uid || '—' }}</code>
          <button v-if="uid" type="button" class="copy-btn" @click="copyUid" title="复制 UID（授权时提供给管理员）">
            <Icon name="doc" :size="16" />复制 UID
          </button>
        </span>
      </div>
      <div class="row uid-tip">
        <span>申请开通农户 / 入库员 / 审计员身份时，将 UID 提供给管理员即可。</span>
      </div>
      <div v-for="row in INFO" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value">{{ row.value }}</span>
      </div>
    </div>

    <button v-if="workspaces.length > 1" type="button" class="btn btn-ghost switch" @click="goSelect">
      <Icon name="swap" :size="20" />切换身份（{{ workspaces.length }} 个工作台）
    </button>
    <div class="actions">
      <a class="btn btn-ghost" :href="SITE_URL">返回官网</a>
      <button type="button" class="btn btn-danger" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">
        <Icon name="logout" :size="20" />{{ loggingOut ? '退出中…' : '退出登录' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.account { max-width: 40rem; min-width: 0; overflow-wrap: anywhere; }
h1 { font-size: var(--text-2xl); line-height: 1.4; margin-bottom: var(--space-5); }
.me { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-6); background: linear-gradient(120deg, var(--color-surface) 55%, var(--role-accent-soft, var(--color-primary-soft))); }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-pill); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); flex: none; }
.me-info { min-width: 0; }
.me-info h2 { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--space-2); }
.me-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.chip { font-size: var(--text-xs); color: var(--role-accent-ink); background: var(--role-accent-soft); max-width: 100%; }
.chip svg { flex: none; }
.list { margin-top: var(--space-4); padding: var(--space-2) var(--space-5); }
.row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) 0; border-bottom: 1px dashed var(--color-border); font-size: var(--text-sm); }
.row:last-child { border-bottom: none; }
.row-label { color: var(--color-text-muted); }
.row-value { font-weight: 500; text-align: right; min-width: 0; max-width: 100%; }
.uid { display: inline-flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; justify-content: flex-end; flex: 1 1 14rem; }
.uid code { max-width: 100%; font-size: var(--text-xs); background: var(--color-surface-muted); border-radius: var(--radius-xs); padding: var(--space-1) var(--space-2); overflow-wrap: anywhere; user-select: all; }
.copy-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1); min-height: var(--control-height); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-pill); transition: border-color var(--duration-fast) var(--ease-standard), background-color var(--duration-fast) var(--ease-standard); }
.copy-btn:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
.uid-tip { justify-content: flex-start; font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.7; }
.switch { width: 100%; margin-top: var(--space-5); }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); }
.actions .btn { flex: 1 1 10rem; }
.btn { min-width: 0; min-height: var(--control-height); white-space: normal; }
:is(button, a):focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
@media (max-width: 480px) {
  .me { flex-direction: column; align-items: flex-start; padding: var(--space-5); }
  .row { align-items: flex-start; flex-direction: column; }
  .row-value { text-align: left; }
  .uid { flex-basis: auto; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) { .copy-btn { transition: none; } }
</style>
