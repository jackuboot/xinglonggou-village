<script setup>
/** 消费者工作台：保留独立导航与业务逻辑，仅共享展示样式。 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { ROLES } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'
import '@/core/styles/workspace.css'
import { focusMainContent } from '@/core/focus'

const route = useRoute()
const router = useRouter()
const { state, maskPhone, phoneOf, logout } = useAuth()
const META = ROLES.consumer
const NAV = [
  { path: '/consumer', label: '逛村货', icon: 'cart', exact: true },
  { path: '/consumer/orders', label: '预约', icon: 'receipt' },
  { path: '/consumer/track', label: '跟踪', icon: 'chart' },
  { path: '/consumer/account', label: '我的', icon: 'user' },
]
const hasMultiple = computed(() => state.roles.length > 1)
const displayPhone = computed(() => maskPhone(phoneOf(state.user)))
const loggingOut = ref(false)

function isActive(item) {
  return item.exact ? route.path === item.path : route.path.startsWith(item.path)
}

async function onLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    try {
      await logout()
    } catch (e) {
      /* 退出失败也回登录页 */
    }
    await router.replace('/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="consumer-app workspace" data-role="consumer">
    <a class="skip-link" href="#consumer-content" @click.prevent="focusMainContent">跳至主要内容</a>
    <aside class="sidebar">
      <div class="side-brand">
        <span class="brand-mark"><Icon :name="META.icon" :size="20" /></span>
        <div class="brand-text">
          <strong>{{ META.shellTitle }}</strong>
          <small>{{ BRAND.name }} · 逛村货与服务预约</small>
        </div>
      </div>
      <nav class="side-nav" aria-label="消费者工作台导航">
        <router-link
          v-for="item in NAV"
          :key="item.path"
          :to="item.path"
          class="side-item"
          :class="{ active: isActive(item) }"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <Icon :name="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <button v-if="hasMultiple" type="button" class="side-switch" @click="router.push('/select')">
        <Icon name="swap" :size="20" /><span>切换身份</span>
      </button>
      <a class="side-link" :href="SITE_URL">
        <Icon name="leaf" :size="20" /><span>官网首页</span>
      </a>
      <div class="side-foot">
        <div class="side-user">
          <span class="avatar"><Icon name="user" :size="16" /></span>
          <span class="side-phone">{{ displayPhone }}</span>
        </div>
        <button type="button" class="side-logout" :aria-label="loggingOut ? '正在退出登录' : '退出登录'" :disabled="loggingOut" :aria-busy="loggingOut" @click="onLogout">
          <Icon name="logout" :size="20" />
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-mark"><Icon :name="META.icon" :size="20" /></span>
          <strong>{{ META.shellTitle }}</strong>
        </div>
        <span class="role-badge"><Icon :name="META.icon" :size="16" />{{ META.name }}</span>
      </header>
      <main id="consumer-content" class="content" tabindex="-1">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in" @after-enter="focusMainContent">
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
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <Icon :name="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>
