<script setup>
/**
 * 账号页：身份、用户 UID、切换身份与退出；不承载管理授权入口。
 * 版式与角色首页同一套区块语言；账号与复制逻辑不变。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { useToast } from '@/core/composables/useToast'
import { ROLES, availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const route = useRoute()
const router = useRouter()
const { state, maskPhone, phoneOf, uidOf, logout } = useAuth()
const { toast } = useToast()

/** 当前所在的工作台（/farmer/account → farmer），用于小标与身份图标；不改权限判断 */
const role = computed(() => ROLES[route.path.split('/')[1]] || null)
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
    <p class="page-kicker">{{ role ? role.name : '工作台' }} · 我的</p>
    <h1 class="page-title">我的账号</h1>
    <p class="page-lead">这个账号用手机号登录；需要新身份时，把下面的用户 UID 提供给管理员。</p>

    <section class="page-section" aria-labelledby="id-heading">
      <h2 id="id-heading" class="section-label">已开通身份</h2>
      <div class="id-row">
        <span class="id-mark"><Icon :name="role ? role.icon : 'user'" :size="22" /></span>
        <strong class="id-phone">{{ displayPhone }}</strong>
      </div>
      <ul class="id-chips" aria-label="已开通身份">
        <li v-for="r in myRoles" :key="r.id" :data-role="r.id">
          <Icon :name="r.icon" :size="16" />{{ r.name }}
        </li>
      </ul>
    </section>

    <section class="page-section" aria-labelledby="uid-heading">
      <h2 id="uid-heading" class="section-label">用户 UID</h2>
      <div class="uid-row">
        <code>{{ uid || '—' }}</code>
        <button v-if="uid" type="button" class="copy-btn" @click="copyUid" title="复制 UID（授权时提供给管理员）">
          <Icon name="doc" :size="16" />复制 UID
        </button>
      </div>
      <p class="section-note">申请开通农户 / 入库员 / 审计员身份时，将这个 UID 提供给管理员即可。</p>
    </section>

    <section class="page-section" aria-labelledby="info-heading">
      <h2 id="info-heading" class="section-label">账号说明</h2>
      <ul class="def-list">
        <li v-for="row in INFO" :key="row.label"><span>{{ row.label }}</span><strong>{{ row.value }}</strong></li>
      </ul>
    </section>

    <div class="foot-actions">
      <button v-if="workspaces.length > 1" type="button" class="btn btn-ghost switch" @click="goSelect">
        <Icon name="swap" :size="20" />切换身份（{{ workspaces.length }} 个工作台）
      </button>
      <a class="back-site" :href="SITE_URL"><span class="back-arrow" aria-hidden="true"><Icon name="arrowRight" :size="16" /></span>返回 {{ BRAND.name }}官网</a>
      <button type="button" class="btn btn-danger" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">
        <Icon name="logout" :size="20" />{{ loggingOut ? '退出中…' : '退出登录' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.account { max-width: 40rem; }

.id-row { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }
.id-mark { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; border-radius: var(--radius-md); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); }
.id-phone { min-width: 0; font-size: var(--text-lg); font-variant-numeric: tabular-nums; }
.id-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
.id-chips li { display: inline-flex; align-items: center; gap: var(--space-1); max-width: 100%; padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 600; color: var(--role-accent-ink, var(--color-primary)); background: var(--role-accent-soft, var(--color-primary-soft)); }
.id-chips svg { flex: none; }

.uid-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }
.uid-row code { max-width: 100%; padding: var(--space-2) var(--space-3); border-radius: var(--radius-xs); font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-surface-muted); overflow-wrap: anywhere; user-select: all; }
.copy-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1); min-height: var(--control-height); padding: var(--space-2) var(--space-4); border: 1px solid var(--color-border-strong); border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); transition: background-color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard); }
.copy-btn svg { flex: none; }
.copy-btn:active { background: var(--color-primary-soft); }

.def-list { margin-top: var(--space-3); border-top: 1px solid var(--color-border-strong); }
.def-list li { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); padding-block: var(--space-3); border-bottom: 1px solid var(--color-border); font-size: var(--text-sm); }
.def-list span { color: var(--color-text-muted); }
.def-list strong { font-weight: 500; }

.foot-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); margin-top: var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--color-border); }
.switch { width: 100%; }
.back-site { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--control-height); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); }
.back-arrow { display: inline-flex; transform: rotate(180deg); }
.back-arrow svg { width: 16px; height: 16px; }
.foot-actions .btn { min-width: 0; white-space: normal; }

@media (hover: hover) {
  .copy-btn:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
}
@media (prefers-reduced-motion: reduce) { .copy-btn { transition: none; } }
</style>
