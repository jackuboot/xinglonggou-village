<script setup>
/**
 * 管理后台首页（总览）：系统状态与授权入口。
 * 仅 admin 可进入（路由守卫已拦截）；状态数据走云函数 roles-admin。
 * 状态用细线状态条呈现，不摆无数据的占位卡片。
 */
import { onMounted, ref } from 'vue'
import Icon from '@/core/components/Icon.vue'
import { fetchAdminStatus } from '../api'
import { BRAND } from '@/core/config'
import { ROLES } from '@/core/roles'

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
    <p class="page-kicker">{{ ROLES.admin.name }} · 管理总览</p>
    <h1 class="page-title">用户授权与系统管理</h1>
    <p class="page-lead">
      {{ BRAND.name }}数字工作台的管理端：维护全村「生产 → 入库 → 使用 → 审计」的角色链路。
      管理后台不在四角色闭环之内，只负责授权与系统状态。
    </p>

    <div v-if="loadError" class="alert" role="alert">{{ loadError }}</div>

    <ul class="status-strip" :aria-busy="!status && !loadError">
      <li>
        <span class="ss-label">已授权账号</span>
        <strong class="ss-value">{{ status ? status.total : '—' }}</strong>
      </li>
      <li>
        <span class="ss-label">管理员状态</span>
        <strong class="ss-value" :class="{ warn: status && !status.hasAdmin }">{{ status ? (status.hasAdmin ? '正常' : '待配置') : '—' }}</strong>
      </li>
    </ul>
    <p v-if="!status && !loadError" class="section-note" role="status">正在加载系统状态…</p>

    <section class="page-section" aria-labelledby="entry-heading">
      <h2 id="entry-heading" class="section-label">管理入口</h2>
      <ul class="row-list">
        <li>
          <router-link class="row-link" to="/admin/users">
            <span class="row-icon"><Icon name="user" :size="20" /></span>
            <span class="row-body">
              <strong>用户授权管理</strong>
              <small>给村民开通 / 修改 / 撤销工作台身份（农户、入库员、审计员、管理员）</small>
            </span>
            <span class="row-arrow" aria-hidden="true"><Icon name="arrowRight" :size="20" /></span>
          </router-link>
        </li>
      </ul>
    </section>

    <section class="page-section" aria-labelledby="steps-heading">
      <h2 id="steps-heading" class="section-label">授权流程</h2>
      <ol class="steps">
        <li><span class="step-no">1</span><span>村民用自己的手机号登录工作台，在「我的」页复制用户 UID 发给管理员；</span></li>
        <li><span class="step-no">2</span><span>管理员在「用户授权管理」中填写 UID 并勾选身份，保存即完成授权；</span></li>
        <li><span class="step-no">3</span><span>对方刷新页面后，即可在选择工作台页看到新身份。</span></li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.admin-home { max-width: 52rem; }

/* 状态条：真实数据，细线分隔，不做卡片 */
.status-strip { display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-8); margin-top: var(--space-6); padding-block: var(--space-4); border-block: 1px solid var(--color-border); }
.status-strip li { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
.ss-label { font-size: var(--text-xs); color: var(--color-text-muted); }
.ss-value { font-size: var(--text-xl); font-weight: 700; font-variant-numeric: tabular-nums; }
.ss-value.warn { color: var(--color-accent-ink); }

.steps { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4); }
.steps li { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--space-3); font-size: var(--text-sm); line-height: 1.8; color: var(--color-text-muted); }
.step-no { font-size: var(--text-xs); font-weight: 700; color: var(--role-accent-ink); font-variant-numeric: tabular-nums; }
</style>
