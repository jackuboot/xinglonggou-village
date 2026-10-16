<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { defaultHome } from '@/core/roles'
import { BRAND, SITE_URL } from '@/core/config'

const router = useRouter()
const { state, sendCode, login, friendlyError } = useAuth()

const phone = ref('')
const code = ref('')
const sending = ref(false)
const logging = ref(false)
const error = ref('')
const countdown = ref(0)
let timer = null
let verificationInfo = null // getVerification 返回，登录时需原样传回

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))
const codeValid = computed(() => /^\d{4,6}$/.test(code.value))
const codeBtnText = computed(() => {
  if (sending.value) return '发送中…'
  if (countdown.value > 0) return `${countdown.value}s 后重发`
  return '获取验证码'
})

function startCountdown() {
  countdown.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function onSendCode() {
  if (!phoneValid.value || sending.value || countdown.value > 0) return
  error.value = ''
  sending.value = true
  try {
    verificationInfo = await sendCode('+86' + phone.value)
    startCountdown()
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    sending.value = false
  }
}

async function onLogin() {
  if (!phoneValid.value || !codeValid.value || logging.value) return
  error.value = ''
  logging.value = true
  try {
    await login('+86' + phone.value, code.value, verificationInfo)
    // 登录成功后统一进入选择工作台页（选身份再进入对应工作台）
    router.replace(defaultHome(state.roles))
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    logging.value = false
  }
}

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="login">
    <div class="login-card">
      <div class="brand-row">
        <span class="brand-mark"><Icon name="leaf" :size="22" /></span>
        <div>
          <h1>{{ BRAND.name }}{{ BRAND.product }}</h1>
          <p>{{ BRAND.slogan }}</p>
        </div>
      </div>

      <div v-if="error" class="alert" role="alert">{{ error }}</div>

      <form @submit.prevent="onLogin">
        <div class="field">
          <label class="field-label" for="phone">手机号</label>
          <div class="input-wrap">
            <span class="prefix">+86</span>
            <input
              id="phone"
              v-model="phone"
              class="input"
              type="tel"
              inputmode="numeric"
              maxlength="11"
              placeholder="请输入 11 位手机号"
              autocomplete="tel"
            />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="code">短信验证码</label>
          <div class="input-wrap">
            <input
              id="code"
              v-model="code"
              class="input"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入验证码"
              autocomplete="one-time-code"
            />
            <button
              type="button"
              class="code-btn"
              :disabled="!phoneValid || sending || countdown > 0"
              @click="onSendCode"
            >
              {{ codeBtnText }}
            </button>
          </div>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block login-btn"
          :disabled="!phoneValid || !codeValid || logging"
        >
          <Icon v-if="!logging" name="arrowRight" :size="18" />
          {{ logging ? '登录中…' : '登录工作台' }}
        </button>
      </form>

      <p class="agreement">未注册的手机号验证通过后将自动创建账号</p>
    </div>

    <a class="back-site" :href="SITE_URL">← 返回 {{ BRAND.name }}官网</a>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 24px 20px;
  background:
    radial-gradient(58% 44% at 82% 12%, rgba(217, 164, 65, 0.28), transparent 62%),
    linear-gradient(165deg, #143626, #173f2e 34%, #2f6b4f 80%, #3d7f5e);
  position: relative;
  overflow: hidden;
}
/* 远山剪影 */
.login::after {
  content: '';
  position: absolute;
  left: -4%;
  right: -4%;
  bottom: -30px;
  height: 190px;
  background:
    radial-gradient(46% 100% at 22% 100%, rgba(255, 255, 255, 0.10), transparent 70%),
    radial-gradient(52% 100% at 68% 100%, rgba(255, 255, 255, 0.07), transparent 72%);
  border-radius: 48% 52% 0 0 / 90% 100% 0 0;
  pointer-events: none;
}

.login-card {
  position: relative;
  z-index: 2;
  width: min(420px, 100%);
  background: #fff;
  border-radius: 24px;
  padding: 38px 34px 30px;
  box-shadow: var(--shadow-lg);
}

.brand-row { display: flex; align-items: center; gap: 13px; margin-bottom: 26px; }
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--brand), var(--brand-dark));
  color: #dff0e4;
  flex: none;
}
.brand-row h1 { font-size: 19px; font-weight: 700; letter-spacing: 0.02em; }
.brand-row p { font-size: 12.5px; color: var(--muted); margin-top: 1px; }

.code-btn {
  padding: 0 14px;
  color: var(--brand);
  font-weight: 600;
  font-size: 13.5px;
  border-left: 1px solid var(--line);
  white-space: nowrap;
  transition: color 0.2s ease;
}
.code-btn:not(:disabled):hover { color: var(--brand-dark); }
.code-btn:disabled { color: #9aaba1; cursor: not-allowed; }

.login-btn { margin-top: 6px; height: 48px; }
.agreement { margin-top: 18px; text-align: center; font-size: 12.5px; color: #93a49b; }

.back-site {
  position: relative;
  z-index: 2;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13.5px;
  transition: color 0.2s ease;
}
.back-site:hover { color: #fff; }

@media (max-width: 480px) {
  .login-card { padding: 30px 22px 24px; border-radius: 20px; }
}
</style>
