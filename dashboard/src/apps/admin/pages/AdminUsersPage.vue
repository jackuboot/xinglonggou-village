<script setup>
/**
 * 用户授权管理页（仅 admin 可进入，路由守卫已拦截）。
 * 给村民账号开通 / 修改 / 撤销工作台身份（农户 / 入库员 / 审计员 / 管理员）。
 * 写操作全部走云函数 roles-admin（管理员权限），前端不具备直写数据库能力。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { useToast } from '@/core/composables/useToast'
import { ADMIN_ROLE, ROLES } from '@/core/roles'
import { fetchUserList, grantUserRoles, revokeUser } from '../api'

const { state, uidOf } = useAuth()
const { toast } = useToast()

const myUid = computed(() => uidOf(state.user))
const loading = ref(true)
const loadError = ref('')
const users = ref([])
const submitting = ref(false)

/** 可授予的角色（consumer 为默认身份，无需授权） */
const GRANTABLE = [
  { id: 'farmer', name: ROLES.farmer.name, desc: '生产和提供服务' },
  { id: 'keeper', name: ROLES.keeper.name, desc: '农产品入库与代理发布' },
  { id: 'auditor', name: ROLES.auditor.name, desc: '独立审计与数据核查' },
  { id: ADMIN_ROLE, name: '管理员', desc: '可授权他人（进入本页）' },
]

const form = reactive({ uid: '', name: '', roles: [] })

function roleName(id) {
  if (id === ADMIN_ROLE) return '管理员'
  return ROLES[id] ? ROLES[id].name : id
}

function fmtTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await fetchUserList()
    users.value = (data && data.users) || []
  } catch (e) {
    loadError.value = e.message || '网络或服务异常，请稍后重试'
  } finally {
    loading.value = false
  }
}

function toggleRole(id) {
  // 编辑自己时不能取消管理员身份（防呆：避免把自己锁在管理后台外）
  const self = !!myUid.value && form.uid.trim() === myUid.value
  if (self && id === ADMIN_ROLE && form.roles.includes(ADMIN_ROLE)) {
    toast('不能移除自己的管理员身份')
    return
  }
  const i = form.roles.indexOf(id)
  if (i >= 0) form.roles.splice(i, 1)
  else form.roles.push(id)
}

function resetForm() {
  form.uid = ''
  form.name = ''
  form.roles = []
}

function editUser(u) {
  form.uid = u.uid
  form.name = u.name || ''
  form.roles = Array.isArray(u.roles) ? [...u.roles] : []
  document.getElementById('grant-uid')?.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

async function onSave() {
  const uid = form.uid.trim()
  if (!uid) { toast('请填写对方的用户 UID'); return }
  if (!form.roles.length) { toast('请至少勾选一个身份'); return }
  // 给自己授权时管理员身份必须保留（防呆：避免把自己锁在管理后台外）
  if (myUid.value && uid === myUid.value && !form.roles.includes(ADMIN_ROLE)) {
    toast('给自己授权时必须保留管理员身份'); return
  }
  submitting.value = true
  try {
    await grantUserRoles(uid, form.roles, form.name.trim())
    toast('已保存授权，对方刷新后生效')
    resetForm()
    await loadList()
  } catch (e) {
    toast(e.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function onRevoke(u) {
  const label = u.name || u.uid
  if (!window.confirm(`确定撤销「${label}」的全部授权？\n撤销后对方将退回为默认消费者身份。`)) return
  try {
    await revokeUser(u.uid)
    toast('已撤销授权')
    await loadList()
  } catch (e) {
    toast(e.message || '撤销失败')
  }
}

onMounted(loadList)
</script>

<template>
  <div class="page-admin">
    <div class="wrap">
      <h1>用户授权</h1>
      <p class="lead">
        给村民账号开通工作台身份：把你的账号作为管理员，通过下方表单为对方授权。
        对方在「我的」页复制 UID 发给你即可；授权保存后对方刷新页面生效。
      </p>

      <section class="card form" aria-labelledby="grant-heading">
        <h2 id="grant-heading">新增 / 更新授权</h2>
        <div class="field">
          <label class="label" for="grant-uid">用户 UID（必填）</label>
          <input id="grant-uid" v-model="form.uid" type="text" placeholder="粘贴对方的用户 UID" spellcheck="false" autocomplete="off" aria-required="true" aria-describedby="grant-uid-help" :disabled="submitting" />
          <p id="grant-uid-help" class="field-help">填写用户 UID，不是手机号。</p>
        </div>
        <div class="field">
          <label class="label" for="grant-name">备注姓名（选填）</label>
          <input id="grant-name" v-model="form.name" type="text" placeholder="例如：张三" maxlength="40" autocomplete="off" :disabled="submitting" />
        </div>
        <fieldset class="field role-field" :disabled="submitting">
          <legend class="label">开通身份（可多选，至少一项）</legend>
          <div class="role-opts">
            <button
              v-for="r in GRANTABLE"
              :key="r.id"
              type="button"
              class="role-opt"
              :data-role="r.id"
              :class="{ on: form.roles.includes(r.id) }"
              :aria-pressed="form.roles.includes(r.id)"
              @click="toggleRole(r.id)"
            >
              <Icon :name="form.roles.includes(r.id) ? 'check' : 'plus'" :size="20" />
              <span class="ro-name">{{ r.name }}</span>
              <span class="ro-desc">{{ r.desc }}</span>
            </button>
          </div>
        </fieldset>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" :disabled="submitting" :aria-busy="submitting" @click="onSave">
            {{ submitting ? '保存中…' : '保存授权' }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="submitting" @click="resetForm">清空</button>
        </div>
        <p class="save-status" role="status" aria-live="polite">{{ submitting ? '正在保存授权，请稍候…' : '' }}</p>
        <p class="form-tip">提示：消费者身份所有登录用户默认具备，无需授权；可以给自己追加身份（用于体验各工作台），但不能移除自己的管理员身份，也不能撤销自己。</p>
      </section>

      <section class="card list" aria-labelledby="users-heading">
        <div class="list-head">
          <h2 id="users-heading">已授权用户 <span v-if="!loading" class="count">{{ users.length }}</span></h2>
          <button type="button" class="refresh" :disabled="loading" :aria-busy="loading" @click="loadList">{{ loading ? '加载中…' : '刷新' }}</button>
        </div>
        <p v-if="loadError" class="state err" role="alert">
          列表加载失败：{{ loadError }}
          <button type="button" class="link" @click="loadList">重试</button>
        </p>
        <p v-else-if="loading" class="state" role="status" aria-live="polite">正在加载已授权用户…</p>
        <p v-else-if="!users.length" class="state" role="status">暂无授权记录。（还没有人获得农户 / 入库员 / 审计员身份）</p>
        <ul v-else class="users">
          <li v-for="u in users" :key="u.uid" class="user">
            <div class="u-main">
              <div class="u-title">
                <strong>{{ u.name || '未命名' }}</strong>
                <span v-if="myUid && u.uid === myUid" class="tag me">当前账号</span>
              </div>
              <code class="u-uid">{{ u.uid }}</code>
              <div class="u-roles">
                <span v-for="r in u.roles" :key="r" class="chip" :data-role="r" :class="{ admin: r === ADMIN_ROLE }">{{ roleName(r) }}</span>
              </div>
            </div>
            <div class="u-ops">
              <span v-if="u.updatedAt" class="u-time">{{ fmtTime(u.updatedAt) }}</span>
              <div class="u-btns">
                <button type="button" class="mini" :aria-label="`编辑 ${u.name || u.uid} 的授权`" @click="editUser(u)">编辑</button>
                <button v-if="!myUid || u.uid !== myUid" type="button" class="mini danger" :aria-label="`撤销 ${u.name || u.uid} 的授权`" @click="onRevoke(u)">撤销</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page-admin { min-width: 0; overflow-wrap: anywhere; }
.wrap { max-width: 52rem; min-width: 0; margin: 0 auto; }
h1 { font-size: var(--text-2xl); line-height: 1.4; margin-bottom: var(--space-3); }
.lead { font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.7; margin-bottom: var(--space-5); }
.card { min-width: 0; padding: var(--space-6); }
.card + .card { margin-top: var(--space-5); }
h2 { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--space-4); }
.field { display: block; min-width: 0; margin-bottom: var(--space-4); }
.label { display: block; font-size: var(--text-sm); color: var(--color-text); font-weight: 600; margin-bottom: var(--space-2); }
.field-help { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-2); }
.field input { width: 100%; min-width: 0; min-height: var(--control-height); padding: var(--space-3); font-size: var(--text-base); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); transition: border-color var(--duration-fast) var(--ease-standard); }
.field input::placeholder { color: var(--color-placeholder); }
.field input:focus { border-color: var(--color-focus); }
.role-field { border: 0; padding: 0; }
.role-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.role-opt { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--space-2); align-items: center; min-width: 0; min-height: var(--control-height); text-align: left; padding: var(--space-3); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); transition: border-color var(--duration-fast) var(--ease-standard), background-color var(--duration-fast) var(--ease-standard); }
.role-opt svg { grid-row: 1 / span 2; color: var(--color-text-muted); }
.role-opt.on { border-color: var(--role-accent); background: var(--role-accent-soft); }
.role-opt.on svg { color: var(--role-accent-ink); }
.role-opt:hover { border-color: var(--role-accent); }
.ro-name { font-size: var(--text-sm); font-weight: 600; }
.ro-desc { font-size: var(--text-xs); color: var(--color-text-muted); }
.form-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-2); }
.form-actions .btn { flex: 1 1 10rem; min-width: 0; min-height: var(--control-height); white-space: normal; }
.form-tip { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-3); line-height: 1.7; }
.save-status { font-size: var(--text-sm); color: var(--color-primary); }
.save-status:not(:empty) { margin-top: var(--space-3); }
.list-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.list-head h2 { margin-bottom: 0; }
.count { display: inline-block; text-align: center; font-size: var(--text-xs); font-weight: 700; color: var(--role-accent-ink); background: var(--role-accent-soft); border-radius: var(--radius-pill); padding: var(--space-1) var(--space-2); font-variant-numeric: tabular-nums; }
.refresh, .mini { min-height: var(--control-height); min-width: var(--control-height); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }
.refresh:not(:disabled):hover, .mini:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
button:disabled, input:disabled { opacity: 0.65; cursor: not-allowed; }
.state { font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-4) 0; }
.state.err { color: var(--color-danger); }
.link { min-height: var(--control-height); min-width: var(--control-height); padding: var(--space-2); color: var(--color-primary); text-decoration: underline; font-size: var(--text-sm); }
.users { display: flex; flex-direction: column; }
.user { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-4); padding: var(--space-5) 0; border-bottom: 1px solid var(--color-border); }
.user:last-child { border-bottom: none; padding-bottom: 0; }
.u-main { min-width: 0; flex: 1 1 16rem; }
.u-title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: var(--text-base); }
.tag.me { font-size: var(--text-xs); color: var(--color-primary); background: var(--color-primary-soft); border-radius: var(--radius-pill); padding: var(--space-1) var(--space-2); }
.u-uid { display: inline-block; max-width: 100%; font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-surface-muted); border-radius: var(--radius-xs); padding: var(--space-1) var(--space-2); margin-top: var(--space-2); overflow-wrap: anywhere; }
.u-roles { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.chip { max-width: 100%; font-size: var(--text-xs); font-weight: 600; color: var(--role-accent-ink); background: var(--role-accent-soft); border-radius: var(--radius-pill); padding: var(--space-1) var(--space-2); }
.u-ops { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); min-width: 0; max-width: 100%; }
.u-time { font-size: var(--text-xs); color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.u-btns { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.mini.danger { color: var(--color-danger); }
.mini.danger:hover { border-color: var(--color-danger); background: var(--color-danger-soft); }
:is(input, button):focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
@media (max-width: 560px) {
  .card { padding: var(--space-5) var(--space-4); }
  .role-opts { grid-template-columns: minmax(0, 1fr); }
  .u-main { flex-basis: 100%; }
  .u-ops { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) { .role-opt, .field input { transition: none; } }
</style>
