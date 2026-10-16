<script setup>
/**
 * 农户工作台 Shell（独立应用界面）
 *
 * 界面隔离：本文件的路由结构、导航与样式仅服务于农户角色，
 * 与其他四个工作台完全独立，修改本文件不影响任何其他角色。
 * 导航：生产 / 农产 / 服务 / 我的
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { ROLES } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const route = useRoute()
const router = useRouter()
const { state, maskPhone, phoneOf, logout } = useAuth()

const META = ROLES.farmer

const NAV = [
  { path: '/farmer', label: '生产', icon: 'leaf', exact: true },
  { path: '/farmer/products', label: '农产', icon: 'box' },
  { path: '/farmer/services', label: '服务', icon: 'spark' },
  { path: '/farmer/account', label: '我的', icon: 'user' },
]

const hasMultiple = computed(() => state.roles.length > 1)
const displayPhone = computed(() => maskPhone(phoneOf(state.user)))

function isActive(item) {
  return item.exact ? route.path === item.path : route.path.startsWith(item.path)
}

async function onLogout() {
  try {
    await logout()
  } catch (e) {
    /* 退出失败也回登录页 */
  }
  router.replace('/login')
}
</script>

<template>
  <div class="farmer-app">
    <aside class="sidebar">
      <div class="side-brand">
        <span class="brand-mark"><Icon :name="META.icon" :size="20" /></span>
        <div class="brand-text">
          <strong>{{ META.shellTitle }}</strong>
          <small>{{ BRAND.name }} · 生产与农事服务</small>
        </div>
      </div>
      <nav class="side-nav" aria-label="农户工作台导航">
        <router-link
          v-for="item in NAV"
          :key="item.path"
          :to="item.path"
          class="side-item"
          :class="{ active: isActive(item) }"
        >
          <Icon :name="item.icon" :size="19" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <button v-if="hasMultiple" class="side-switch" @click="router.push('/select')">
        <Icon name="swap" :size="18" />
        <span>切换身份</span>
      </button>
      <a class="side-link" :href="SITE_URL">
        <Icon name="leaf" :size="18" />
        <span>官网首页</span>
      </a>
      <div class="side-foot">
        <div class="side-user">
          <span class="avatar"><Icon name="user" :size="16" /></span>
          <span class="side-phone">{{ displayPhone }}</span>
        </div>
        <button class="side-logout" aria-label="退出登录" @click="onLogout">
          <Icon name="logout" :size="17" />
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-mark"><Icon :name="META.icon" :size="16" /></span>
          <strong>{{ META.shellTitle }}</strong>
        </div>
        <h1 class="topbar-title">{{ route.meta.title }}</h1>
        <span class="role-badge"><Icon :name="META.icon" :size="14" />{{ META.name }}</span>
        <span class="topbar-user">{{ displayPhone }}</span>
      </header>
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <nav class="tabbar" aria-label="底部导航">
      <router-link
        v-for="item in NAV"
        :key="item.path"
        :to="item.path"
        class="tab-item"
        :class="{ active: isActive(item) }"
      >
        <Icon :name="item.icon" :size="21" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <a class="back-site" :href="SITE_URL" title="返回官网">{{ BRAND.name }}官网</a>
  </div>
</template>

<style scoped>
/* 农户工作台主题：田园禾绿 */
.farmer-app {
  --role-accent: #5c7a2e;
  --role-accent-soft: #eef3e2;
  --role-accent-ink: #3f5619;
  --role-accent-light: #b5d178;
  --role-deep: #26351a;
  min-height: 100vh;
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(145deg, var(--role-accent), var(--role-deep));
  color: #eaf3d8;
  flex: none;
}
.back-site { display: none; }

.sidebar { display: none; }
@media (min-width: 900px) {
  .farmer-app { display: grid; grid-template-columns: 236px 1fr; }
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--role-deep);
    color: #fff;
    padding: 22px 14px;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .side-brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 22px; }
  .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-text strong { font-size: 15.5px; letter-spacing: 0.03em; }
  .brand-text small { font-size: 11px; color: rgba(255, 255, 255, 0.55); }
  .side-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .side-item, .side-switch, .side-link {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    font-size: 14.5px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.72);
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .side-item:hover, .side-switch:hover, .side-link:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
  .side-item.active { background: rgba(255, 255, 255, 0.12); color: #fff; font-weight: 600; }
  .side-item.active :deep(svg) { color: var(--role-accent-light); }
  .side-switch, .side-link { margin-bottom: 6px; }
  .side-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 10px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
  .side-user { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.85);
    flex: none;
  }
  .side-phone { font-size: 13px; color: rgba(255, 255, 255, 0.85); white-space: nowrap; }
  .side-logout {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.6);
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .side-logout:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
}

.main { display: flex; flex-direction: column; min-width: 0; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.topbar-brand { display: none; align-items: center; gap: 8px; font-size: 14px; }
.topbar-brand .brand-mark { width: 28px; height: 28px; border-radius: 9px; }
.topbar-title { font-size: 17px; font-weight: 700; flex: 1; }
.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--role-accent-ink);
  background: var(--role-accent-soft);
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
  flex: none;
}
.topbar-user {
  font-size: 12.5px;
  color: var(--muted);
  background: #eef1ef;
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
}
.content { flex: 1; padding: 24px 28px calc(40px + env(safe-area-inset-bottom)); }

.tabbar { display: none; }
@media (max-width: 899px) {
  .topbar-brand { display: flex; }
  .topbar { padding: 12px 16px; }
  .topbar-title { font-size: 16px; }
  .topbar-user { display: none; }
  .content { padding: 16px 16px calc(86px + env(safe-area-inset-bottom)); }
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    display: flex;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 9px 0 7px;
    font-size: 11px;
    color: var(--muted);
    transition: color 0.2s ease;
  }
  .tab-item.active { color: var(--role-accent); font-weight: 600; }
}
</style>
