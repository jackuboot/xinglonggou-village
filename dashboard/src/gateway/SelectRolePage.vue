<script setup>
/** 登录后的选择工作台页：展示全部可用身份，选择进入对应工作台 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, logout } = useAuth()

const workspaces = computed(() => availableWorkspaces(state.roles))

async function onLogout() {
  await logout()
  router.replace('/login')
}
</script>

<template>
  <div class="select">
    <header class="head">
      <h1>选择工作台</h1>
      <p>{{ BRAND.name }}{{ BRAND.product }} · {{ workspaces.length > 1 ? '你拥有多个身份，选择以哪个进入' : '已为你开通以下工作台' }}</p>
    </header>

    <div class="cards">
      <router-link v-for="w in workspaces" :key="w.id" :to="w.home" class="card role-card">
        <span class="role-ic"><Icon :name="w.icon" :size="24" /></span>
        <strong>{{ w.name }}</strong>
        <small>{{ w.desc }}</small>
        <span class="role-enter">进入<Icon name="arrowRight" :size="14" /></span>
      </router-link>
    </div>

    <div class="foot-actions">
      <a class="btn btn-ghost" :href="SITE_URL">← 返回官网</a>
      <button class="btn btn-ghost" @click="onLogout">
        <Icon name="logout" :size="16" /> 退出登录
      </button>
    </div>
  </div>
</template>

<style scoped>
.select {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
  padding: 32px 20px;
}
.head { text-align: center; }
.head h1 { font-size: 22px; font-weight: 700; }
.head p { color: var(--muted); font-size: 13.5px; margin-top: 4px; }

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 220px));
  gap: 16px;
  justify-content: center;
  width: 100%;
}
.role-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 20px 22px;
  text-align: center;
  transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}
.role-card:hover { border-color: var(--brand); box-shadow: var(--shadow-md); transform: translateY(-2px); }
.role-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 17px;
  background: linear-gradient(145deg, var(--brand), var(--brand-dark));
  color: #dff0e4;
  margin-bottom: 4px;
}
.role-card strong { font-size: 16px; }
.role-card small { color: var(--muted); font-size: 12.5px; line-height: 1.5; min-height: 38px; }
.role-enter {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  color: var(--brand);
  font-size: 13px;
  font-weight: 600;
}
.foot-actions { display: flex; gap: 12px; margin-top: 4px; }
</style>
