<script setup>
/** 越权访问提示页：当前账号无该工作台权限 */
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { defaultHome } from '@/core/roles'

const router = useRouter()
const { state, logout } = useAuth()

function goHome() {
  router.replace(defaultHome(state.roles))
}

async function onLogout() {
  await logout()
  router.replace('/login')
}
</script>

<template>
  <div class="wrap">
    <div class="card box">
      <span class="ic"><Icon name="shield" :size="30" /></span>
      <h1>暂无访问权限</h1>
      <p>
        当前账号没有访问该工作台的权限。如需使用对应身份（农户 / 入库员 / 审计员），
        请联系管理员为你的账号开通授权。
      </p>
      <div class="actions">
        <button class="btn btn-primary" @click="goHome">返回选择工作台</button>
        <button class="btn btn-ghost" @click="onLogout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
.box {
  width: min(440px, 100%);
  padding: 42px 32px 34px;
  text-align: center;
}
.ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 66px;
  height: 66px;
  border-radius: 21px;
  background: var(--danger-soft);
  color: var(--danger);
  margin-bottom: 16px;
}
h1 { font-size: 20px; font-weight: 700; }
p { color: var(--muted); font-size: 13.5px; margin-top: 10px; line-height: 1.65; }
.actions {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
  margin-top: 24px;
}
</style>
