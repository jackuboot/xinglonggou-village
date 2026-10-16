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
  <div class="page">
    <p class="lead">
      {{ BRAND.name }}数字工作台的管理端：为村民账号开通工作台身份，
      维护全村「生产 → 入库 → 使用 → 审计」的角色链路。
    </p>

    <div v-if="loadError" class="alert">{{ loadError }}</div>

    <div class="stats">
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
      <Icon name="arrowRight" :size="18" class="entry-arrow" />
    </router-link>

    <div class="card tips">
      <h3><Icon name="spark" :size="15" /> 授权流程</h3>
      <ol>
        <li>村民用自己的手机号登录工作台，在「我的」页复制用户 UID 发给管理员；</li>
        <li>管理员在「用户授权管理」中填写 UID 并勾选身份，保存即完成授权；</li>
        <li>对方刷新页面后，即可在选择工作台页看到新身份。</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 720px; }
.lead {
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.8;
  margin-bottom: 18px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 220px));
  gap: 14px;
  margin-bottom: 14px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}
.stat-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--role-accent-soft, #f8eed6);
  color: var(--role-accent-ink, #8a6420);
  flex: none;
}
.stat-body { display: flex; flex-direction: column; line-height: 1.3; }
.stat-body strong { font-size: 20px; }
.stat-body small { font-size: 12px; color: var(--muted); margin-top: 2px; }

.entry {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  margin-bottom: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
}
.entry:hover {
  border-color: var(--role-accent, #d9a441);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.entry-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: linear-gradient(145deg, #2a3b31, #141d18);
  color: #e8c072;
  flex: none;
}
.entry-body { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.45; }
.entry-body strong { font-size: 15px; }
.entry-body small { font-size: 12.5px; color: var(--muted); }
.entry-arrow { color: var(--muted); flex: none; }

.tips { padding: 18px 22px; }
.tips h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  margin-bottom: 10px;
}
.tips ol {
  list-style: decimal;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tips li { font-size: 13px; color: var(--muted); line-height: 1.65; }
</style>
