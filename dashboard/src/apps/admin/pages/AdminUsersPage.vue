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
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
    <main class="wrap">
      <p class="lead">
        给村民账号开通工作台身份：把你的账号作为管理员，通过下方表单为对方授权。
        对方在「我的」页复制 UID 发给你即可；授权保存后对方刷新页面生效。
      </p>

      <section class="card form">
        <h2>新增 / 更新授权</h2>
        <label class="field">
          <span class="label">用户 UID</span>
          <input v-model="form.uid" type="text" placeholder="粘贴对方的用户 UID" spellcheck="false" />
        </label>
        <label class="field">
          <span class="label">备注姓名（选填）</span>
          <input v-model="form.name" type="text" placeholder="例如：张三" maxlength="40" />
        </label>
        <div class="field">
          <span class="label">开通身份（可多选）</span>
          <div class="role-opts">
            <button
              v-for="r in GRANTABLE"
              :key="r.id"
              type="button"
              class="role-opt"
              :class="{ on: form.roles.includes(r.id) }"
              @click="toggleRole(r.id)"
            >
              <Icon :name="form.roles.includes(r.id) ? 'check' : 'plus'" :size="14" />
              <span class="ro-name">{{ r.name }}</span>
              <span class="ro-desc">{{ r.desc }}</span>
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" :disabled="submitting" @click="onSave">
            {{ submitting ? '保存中…' : '保存授权' }}
          </button>
          <button class="btn btn-ghost" :disabled="submitting" @click="resetForm">清空</button>
        </div>
        <p class="form-tip">提示：消费者身份所有登录用户默认具备，无需授权；可以给自己追加身份（用于体验各工作台），但不能移除自己的管理员身份，也不能撤销自己。</p>
      </section>

      <section class="card list">
        <div class="list-head">
          <h2>已授权用户 <span v-if="!loading" class="count">{{ users.length }}</span></h2>
          <button class="refresh" :disabled="loading" @click="loadList">
            {{ loading ? '加载中…' : '刷新' }}
          </button>
        </div>

        <p v-if="loadError" class="state err">
          列表加载失败：{{ loadError }}
          <button class="link" @click="loadList">重试</button>
        </p>
        <p v-else-if="loading" class="state">正在加载…</p>
        <p v-else-if="!users.length" class="state">
          暂无授权记录。（还没有人获得农户 / 入库员 / 审计员身份）
        </p>

        <ul v-else class="users">
          <li v-for="u in users" :key="u.uid" class="user">
            <div class="u-main">
              <div class="u-title">
                <strong>{{ u.name || '未命名' }}</strong>
                <span v-if="myUid && u.uid === myUid" class="tag me">当前账号</span>
              </div>
              <code class="u-uid">{{ u.uid }}</code>
              <div class="u-roles">
                <span v-for="r in u.roles" :key="r" class="chip" :class="{ admin: r === ADMIN_ROLE }">
                  {{ roleName(r) }}
                </span>
              </div>
            </div>
            <div class="u-ops">
              <span v-if="u.updatedAt" class="u-time">{{ fmtTime(u.updatedAt) }}</span>
              <div class="u-btns">
                <button class="mini" @click="editUser(u)">编辑</button>
                <button v-if="!myUid || u.uid !== myUid" class="mini danger" @click="onRevoke(u)">撤销</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 管理后台内的页面：将全局品牌变量覆盖为金色系，与后台主题一致 */
.page-admin {
  --brand: #b8860b;
  --brand-dark: #96700a;
  --brand-deep: #141d18;
  --brand-soft: #faf1dd;
}

.wrap { max-width: 700px; margin: 0 auto; }
.lead { font-size: 13px; color: var(--muted); line-height: 1.7; margin-bottom: 16px; }

.card { padding: 20px; }
.card + .card { margin-top: 16px; }
h2 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }

.field { display: block; margin-bottom: 14px; }
.label { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 7px; }
.field input {
  width: 100%;
  padding: 11px 13px;
  font-size: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  outline: none;
  transition: border-color 0.2s ease;
}
.field input:focus { border-color: var(--brand); }

.role-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.role-opt {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fff;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.role-opt svg { grid-row: 1 / span 2; color: var(--muted); }
.role-opt.on { border-color: var(--brand); background: var(--brand-soft); }
.role-opt.on svg { color: var(--brand); }
.ro-name { font-size: 13.5px; font-weight: 600; }
.ro-desc { font-size: 11.5px; color: var(--muted); }

.form-actions { display: grid; grid-template-columns: 1.5fr 1fr; gap: 10px; margin-top: 4px; }
.form-tip { font-size: 12px; color: #93a49b; margin-top: 12px; line-height: 1.6; }

.list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.list-head h2 { margin-bottom: 0; }
.count {
  display: inline-block;
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 999px;
  padding: 1px 7px;
  margin-left: 4px;
}
.refresh {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand);
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
}
.refresh:hover { border-color: var(--brand); background: var(--brand-soft); }
.refresh:disabled { opacity: 0.6; }

.state { font-size: 13px; color: var(--muted); padding: 14px 2px; }
.state.err { color: var(--danger); }
.link { color: var(--brand); text-decoration: underline; font-size: 13px; margin-left: 6px; }

.users { display: flex; flex-direction: column; }
.user {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 2px;
  border-bottom: 1px dashed var(--line);
}
.user:last-child { border-bottom: none; }
.u-main { min-width: 0; }
.u-title { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.tag.me {
  font-size: 11px;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.u-uid {
  display: inline-block;
  font-size: 11.5px;
  color: #87968d;
  background: #f2f5f3;
  border-radius: 6px;
  padding: 2px 7px;
  margin-top: 5px;
  word-break: break-all;
  max-width: 100%;
}
.u-roles { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--brand-dark, #2c6e49);
  background: var(--brand-soft);
  border-radius: 999px;
  padding: 2px 9px;
}
.chip.admin { color: #7a5b00; background: #fdf3d7; }
.u-ops { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex: none; }
.u-time { font-size: 11.5px; color: #a5b3aa; }
.u-btns { display: flex; gap: 7px; }
.mini {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--brand);
}
.mini:hover { border-color: var(--brand); background: var(--brand-soft); }
.mini.danger { color: var(--danger); }
.mini.danger:hover { border-color: var(--danger); background: var(--danger-soft); }

@media (max-width: 560px) {
  .role-opts { grid-template-columns: 1fr; }
  .user { flex-direction: column; }
  .u-ops { align-items: flex-start; }
}
</style>
