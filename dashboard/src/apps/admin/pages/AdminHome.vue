<script setup>
/**
 * 管理后台首页（总览）：系统状态与快捷入口。
 * 仅 admin 可进入（路由守卫已拦截）；状态数据走云函数 roles-admin。
 */
import { onMounted, ref } from 'vue'
import Icon from '@/core/components/Icon.vue'
import { fetchAdminStatus } from '../api'
import { BRAND } from '@/core/config'

const status = ref(null)
const loadError = ref('')

onMounted(async () => {
  try {
    status.value = await fetchAdminStatus()
  } catch (e) {
    loadError.value = e.message || '状态加载失败'
  }
})
</script>

<template>
  <div class="page admin-home">
    <h1>管理总览</h1>
    <p class="lead">
      {{ BRAND.name }}数字工作台的管理端：为村民账号开通工作台身份，
      维护全村「生产 → 入库 → 使用 → 审计」的角色链路。
    </p>
    <div v-if="loadError" class="alert" role="alert">{{ loadError }}</div>
    <p v-else-if="!status" class="load-status" role="status">正在加载系统状态…</p>

    <div class="stats" :aria-busy="!status && !loadError">
      <div class="card stat">
        <span class="stat-ic"><Icon name="user" :size="20" /></span>
        <div class="stat-body">
          <strong>{{ status ? status.total : '—' }}</strong>
          <small>已授权账号</small>
        </div>
      </div>
      <div class="card stat">
        <span class="stat-ic"><Icon name="shield" :size="20" /></span>
        <div class="stat-body">
          <strong>{{ status ? (status.hasAdmin ? '正常' : '待配置') : '—' }}</strong>
          <small>管理员状态</small>
        </div>
      </div>
    </div>

    <router-link to="/admin/users" class="card entry">
      <span class="entry-ic"><Icon name="user" :size="20" /></span>
      <div class="entry-body">
        <strong>用户授权管理</strong>
        <small>给村民开通 / 修改 / 撤销工作台身份（农户、入库员、审计员、管理员）</small>
      </div>
      <Icon name="arrowRight" :size="20" class="entry-arrow" />
    </router-link>
    <section class="card tips" aria-labelledby="auth-steps-heading">
      <h2 id="auth-steps-heading"><Icon name="spark" :size="20" />授权流程</h2>
      <ol>
        <li>村民用自己的手机号登录工作台，在「我的」页复制用户 UID 发给管理员；</li>
        <li>管理员在「用户授权管理」中填写 UID 并勾选身份，保存即完成授权；</li>
        <li>对方刷新页面后，即可在选择工作台页看到新身份。</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.admin-home { max-width: 52rem; min-width: 0; overflow-wrap: anywhere; }
h1 { font-size: var(--text-2xl); line-height: 1.4; margin-bottom: var(--space-3); }
.lead { font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.8; margin-bottom: var(--space-5); }
.load-status { font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-4); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--space-4); margin-bottom: var(--space-4); }
.stat { display: flex; align-items: center; gap: var(--space-3); min-width: 0; padding: var(--space-5); }
.stat-ic { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--role-accent-soft); color: var(--role-accent-ink); flex: none; }
.stat-body { min-width: 0; display: flex; flex-direction: column; line-height: 1.5; }
.stat-body strong { font-size: var(--text-2xl); font-variant-numeric: tabular-nums; }
.stat-body small { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-1); }
.entry { display: flex; align-items: center; gap: var(--space-3); min-height: var(--control-height); min-width: 0; padding: var(--space-5); margin-bottom: var(--space-4); transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard); }
.entry:hover { border-color: var(--role-accent); box-shadow: var(--shadow-md); }
.entry:active { background: var(--color-surface-muted); }
.entry:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.entry-ic { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--role-deep); color: var(--role-accent-light); flex: none; }
.entry-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); line-height: 1.6; }
.entry-body strong { font-size: var(--text-base); }
.entry-body small { font-size: var(--text-sm); color: var(--color-text-muted); }
.entry-arrow { color: var(--color-text-muted); flex: none; }
.tips { padding: var(--space-5); }
.tips h2 { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); margin-bottom: var(--space-3); }
.tips h2 svg { flex: none; }
.tips ol { list-style: decimal; padding-left: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); }
.tips li { font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.7; }
@media (max-width: 480px) { .entry { padding: var(--space-4); gap: var(--space-2); } }
@media (prefers-reduced-motion: reduce) { .entry { transition: none; } }
</style>
