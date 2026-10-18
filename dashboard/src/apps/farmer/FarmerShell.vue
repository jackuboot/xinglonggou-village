<script setup>
/** 农户工作台：保留独立导航与业务逻辑，仅共享展示样式。 */
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
const META = ROLES.farmer
const NAV = [
  { path: '/farmer', label: '生产', icon: 'leaf', exact: true },
  { path: '/farmer/products', label: '农产', icon: 'box' },
  { path: '/farmer/services', label: '服务', icon: 'spark' },
  { path: '/farmer/account', label: '我的', icon: 'user' },
]
const hasMultiple = computed(() => state.roles.length > 1)
const displayPhone = computed(() => maskPhone(phoneOf(state.user)))
const loggingOut = ref(false)

function isActive(item) {
  return item.exact ? route.path === item.path : route.path.startsWith(item.path)
}

/** 宽屏顶栏显示当前分区（侧栏已显示工作台名），窄屏侧栏隐藏时回退为工作台名 */
const currentLabel = computed(() => {
  const item = NAV.find(entry => isActive(entry))
  return item ? item.label : META.shellTitle
})

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
  <div class="farmer-app workspace" data-role="farmer">
    <a class="skip-link" href="#farmer-content" @click.prevent="focusMainContent">跳至主要内容</a>
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
          <strong class="tb-desk">{{ currentLabel }}</strong>
          <strong class="tb-phone">{{ META.shellTitle }}</strong>
        </div>
        <span class="role-badge"><Icon :name="META.icon" :size="16" />{{ META.name }}</span>
      </header>
      <main id="farmer-content" class="content" tabindex="-1">
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
