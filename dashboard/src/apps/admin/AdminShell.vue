<script setup>
/**
 * 管理后台 Shell（独立应用界面）
 *
 * 界面隔离：本文件的路由结构、导航与样式仅服务于管理后台，
 * 与其他四个角色工作台完全独立。视觉上采用深色管理端风格（墨黑 + 金），
 * 与业务工作台的浅色名片式布局明显区分。
 * 导航：管理总览 / 用户授权
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

const META = ROLES.admin

const NAV = [
  { path: '/admin', label: '管理总览', icon: 'grid', exact: true },
  { path: '/admin/users', label: '用户授权', icon: 'user' },
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
  <div class="admin-app">
    <aside class="sidebar">
      <div class="side-brand">
        <span class="brand-mark"><Icon name="settings" :size="20" /></span>
        <div class="brand-text">
          <strong>{{ META.shellTitle }}</strong>
          <small>{{ BRAND.name }} · 系统运营与授权</small>
        </div>
      </div>
      <span class="env-chip">超级管理员入口</span>
      <nav class="side-nav" aria-label="管理后台导航">
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
          <span class="brand-mark"><Icon name="settings" :size="16" /></span>
          <strong>{{ META.shellTitle }}</strong>
        </div>
        <h1 class="topbar-title">{{ route.meta.title }}</h1>
        <span class="role-badge"><Icon name="settings" :size="14" />管理员</span>
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
/* 管理后台主题：墨黑底 + 金 accent（与业务工作台明确区分） */
.admin-app {
  --role-accent: #d9a441;
  --role-accent-soft: #f8eed6;
  --role-accent-ink: #8a6420;
  --role-accent-light: #e8c072;
  --role-deep: #141d18;
  min-height: 100vh;
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(145deg, #2a3b31, #0f1613);
  border: 1px solid rgba(217, 164, 65, 0.45);
  color: #e8c072;
  flex: none;
}
.back-site { display: none; }
.env-chip {
  display: none;
  font-size: 11px;
  color: rgba(232, 192, 114, 0.85);
  background: rgba(217, 164, 65, 0.12);
  border: 1px solid rgba(217, 164, 65, 0.25);
  border-radius: 999px;
  padding: 4px 12px;
  margin: 0 10px 16px;
  white-space: nowrap;
  align-self: flex-start;
}

.sidebar { display: none; }
@media (min-width: 900px) {
  .admin-app { display: grid; grid-template-columns: 236px 1fr; }
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
  .side-brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 18px; }
  .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-text strong { font-size: 15.5px; letter-spacing: 0.03em; }
  .brand-text small { font-size: 11px; color: rgba(255, 255, 255, 0.5); }
  .env-chip { display: inline-block; }
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
    color: rgba(255, 255, 255, 0.7);
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .side-item:hover, .side-switch:hover, .side-link:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
  .side-item.active { background: rgba(217, 164, 65, 0.16); color: #fff; font-weight: 600; }
  .side-item.active :deep(svg) { color: var(--role-accent-light); }
  .side-switch, .side-link { margin-bottom: 6px; }
  .side-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 10px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .side-user { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
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
  .side-logout:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
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
  background: rgba(252, 251, 248, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e8e2d4;
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
  border: 1px solid rgba(217, 164, 65, 0.35);
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
  flex: none;
}
.topbar-user {
  font-size: 12.5px;
  color: var(--muted);
  background: #f0ece1;
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
    background: rgba(20, 29, 24, 0.97);
    backdrop-filter: blur(10px);
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
    color: rgba(255, 255, 255, 0.55);
    transition: color 0.2s ease;
  }
  .tab-item.active { color: var(--role-accent-light); font-weight: 600; }
}
</style>
