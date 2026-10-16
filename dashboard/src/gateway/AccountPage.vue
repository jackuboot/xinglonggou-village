<script setup>
/**
 * 账号页（各工作台「我的」共用）：身份信息、用户 UID、切换身份与退出。
 * 说明：系统管理功能已归入独立的管理后台（/admin），本页不承载任何管理入口；
 * 申请内部身份的方式：把 UID 提供给管理员，由其在管理后台授权。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { useToast } from '@/core/composables/useToast'
import { ROLES, availableWorkspaces } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, maskPhone, phoneOf, uidOf, logout } = useAuth()
const { toast } = useToast()

const displayPhone = maskPhone(phoneOf(state.user)) || '已登录'
const uid = computed(() => uidOf(state.user))
const myRoles = computed(() => state.roles.map(id => ROLES[id]).filter(Boolean))
const workspaces = computed(() => availableWorkspaces(state.roles))

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
  await logout()
  router.replace('/login')
}
</script>

<template>
  <div class="page account">
    <div class="card me">
      <span class="avatar"><Icon name="user" :size="26" /></span>
      <div class="me-info">
        <h2>{{ displayPhone }}</h2>
        <div class="me-chips">
          <span v-for="r in myRoles" :key="r.id" class="chip">
            <Icon :name="r.icon" :size="13" /> {{ r.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="card list">
      <div class="row">
        <span class="row-label">用户 UID</span>
        <span class="row-value uid">
          <code>{{ uid || '—' }}</code>
          <button v-if="uid" class="copy-btn" @click="copyUid" title="复制 UID（授权时提供给管理员）">
            <Icon name="doc" :size="14" /> 复制
          </button>
        </span>
      </div>
      <div class="row uid-tip">
        <span>申请开通农户 / 入库员 / 审计员身份时，将 UID 提供给管理员即可。</span>
      </div>
      <div v-for="row in INFO" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value">{{ row.value }}</span>
      </div>
    </div>

    <button v-if="workspaces.length > 1" class="btn btn-ghost switch" @click="goSelect">
      <Icon name="swap" :size="17" /> 切换身份（{{ workspaces.length }} 个工作台）
    </button>

    <div class="actions">
      <a class="btn btn-ghost" :href="SITE_URL">返回官网</a>
      <button class="btn btn-danger" @click="onLogout">
        <Icon name="logout" :size="17" /> 退出登录
      </button>
    </div>
  </div>
</template>

<style scoped>
.account { max-width: 560px; }
.me {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 26px 24px;
  background: linear-gradient(135deg, #ffffff 58%, var(--brand-soft));
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--brand), var(--brand-dark));
  color: #dff0e4;
  flex: none;
}
.me-info h2 { font-size: 18px; font-weight: 700; margin-bottom: 7px; }
.me-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.list { margin-top: 14px; padding: 6px 20px; }
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 14px;
}
.row:last-child { border-bottom: none; }
.row-label { color: var(--muted); flex: none; }
.row-value { font-weight: 500; text-align: right; }
.uid { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.uid code {
  font-size: 12px;
  background: #f2f5f3;
  border-radius: 7px;
  padding: 3px 8px;
  word-break: break-all;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand);
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.copy-btn:hover { border-color: var(--brand); background: var(--brand-soft); }
.uid-tip {
  justify-content: flex-start;
  font-size: 12.5px;
  color: #93a49b;
  padding: 10px 0 12px;
  line-height: 1.6;
}

.switch { width: 100%; margin-top: 14px; }

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
</style>
