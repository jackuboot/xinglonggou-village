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
const phoneError = ref('')
const codeError = ref('')
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
  <main class="login">
    <div class="login-card">
      <div class="brand-row">
        <span class="brand-mark"><Icon name="leaf" :size="24" /></span>
        <div class="brand-copy">
          <h1>{{ BRAND.name }}{{ BRAND.product }}</h1>
          <p>{{ BRAND.slogan }}</p>
        </div>
      </div>
      <p class="intro">使用手机号登录，进入你的工作台。</p>
      <div v-if="error" class="alert" role="alert">{{ error }}</div>

      <form novalidate :aria-busy="sending || logging" @submit.prevent="onLogin">
        <div class="field">
          <label class="field-label" for="phone">手机号</label>
          <div class="input-wrap" :class="{ invalid: phoneError }">
            <span class="prefix" aria-hidden="true">+86</span>
            <input
              id="phone"
              v-model="phone"
              name="phone"
              class="input"
              type="tel"
              inputmode="numeric"
              maxlength="11"
              placeholder="请输入 11 位手机号"
              autocomplete="tel-national"
              required
              :readonly="sending || logging"
              :aria-invalid="Boolean(phoneError)"
              :aria-describedby="phoneError ? 'phone-help phone-error' : 'phone-help'"
              @blur="phoneError = phoneValid ? '' : '请输入有效的 11 位手机号'"
              @input="phoneError = ''"
            />
          </div>
          <p id="phone-help" class="field-help">中国大陆手机号（+86）</p>
          <p v-if="phoneError" id="phone-error" class="field-error" role="alert">{{ phoneError }}</p>
        </div>

        <div class="field">
          <label class="field-label" for="code">短信验证码</label>
          <div class="input-wrap code-wrap" :class="{ invalid: codeError }">
            <input
              id="code"
              v-model="code"
              name="code"
              class="input"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入验证码"
              autocomplete="one-time-code"
              required
              :readonly="logging"
              :aria-invalid="Boolean(codeError)"
              :aria-describedby="codeError ? 'code-help code-error' : 'code-help'"
              @blur="codeError = codeValid ? '' : '请输入短信中的 4 至 6 位数字验证码'"
              @input="codeError = ''"
            />
            <button
              type="button"
              class="code-btn"
              :disabled="!phoneValid || sending || countdown > 0"
              :aria-busy="sending"
              @click="onSendCode"
            >
              {{ codeBtnText }}
            </button>
          </div>
          <p id="code-help" class="field-help">填写短信中的 4 至 6 位数字</p>
          <p v-if="codeError" id="code-error" class="field-error" role="alert">{{ codeError }}</p>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-block login-btn"
          :disabled="!phoneValid || !codeValid || logging"
          :aria-busy="logging"
        >
          <Icon v-if="!logging" name="arrowRight" :size="20" />
          {{ logging ? '登录中…' : '登录工作台' }}
        </button>
      </form>
      <p class="request-status" role="status" aria-live="polite">{{ logging ? '正在验证，请稍候…' : sending ? '正在发送验证码…' : countdown > 0 ? '验证码已发送，请查收短信。' : '' }}</p>
      <p class="agreement">未注册的手机号验证通过后将自动创建账号</p>
    </div>
    <a class="back-site" :href="SITE_URL"><Icon name="arrowRight" :size="16" class="back-arrow" />返回 {{ BRAND.name }}官网</a>
  </main>
</template>

<style scoped>
.login { min-width: 0; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-5); padding: var(--space-8) var(--space-4); background: var(--gradient-login); overflow-wrap: anywhere; }
.login-card { width: min(28rem, 100%); min-width: 0; background: var(--color-surface); border: 1px solid var(--color-overlay-border); border-radius: var(--radius-lg); padding: var(--space-8); box-shadow: var(--shadow-lg); }
.brand-row { display: flex; align-items: center; gap: var(--space-3); }
.brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--gradient-brand); color: var(--color-on-primary); flex: none; }
.brand-copy { min-width: 0; }
.brand-row h1 { font-size: var(--text-xl); font-weight: 700; line-height: 1.4; }
.brand-row p { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-1); }
.intro { font-size: var(--text-sm); color: var(--color-text-muted); margin: var(--space-5) 0 var(--space-6); }
.field-label { color: var(--color-text); font-size: var(--text-sm); }
.input-wrap { min-width: 0; background: var(--color-surface-muted); border-color: var(--color-border-strong); }
.input-wrap:focus-within { background: var(--color-surface); border-color: var(--color-focus); }
.input-wrap.invalid { border-color: var(--color-danger); }
.input { width: 100%; min-width: 0; min-height: var(--control-height); font-size: var(--text-base); color: var(--color-text); padding: var(--space-3); border-radius: var(--radius-sm); }
.input::placeholder { color: var(--color-placeholder); }
.prefix { font-size: var(--text-base); }
.code-btn { min-height: var(--control-height); padding: var(--space-3); color: var(--color-primary); font-weight: 600; font-size: var(--text-sm); border-left: 1px solid var(--color-border); white-space: normal; flex: 0 0 auto; transition: color var(--duration-fast) var(--ease-standard); }
.code-btn:not(:disabled):hover { color: var(--color-primary-hover); background: var(--color-primary-soft); }
.code-btn:disabled { color: var(--color-text-muted); cursor: not-allowed; }
.field-help, .field-error { margin-top: var(--space-2); font-size: var(--text-xs); }
.field-help { color: var(--color-text-muted); }
.field-error { color: var(--color-danger); }
.login-btn { margin-top: var(--space-2); min-height: var(--control-height); white-space: normal; }
.request-status { font-size: var(--text-sm); color: var(--color-primary); }
.request-status:not(:empty) { margin-top: var(--space-3); }
.agreement { margin-top: var(--space-4); text-align: center; font-size: var(--text-xs); color: var(--color-text-muted); }
.back-site { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: var(--control-height); padding: var(--space-2); color: var(--color-on-dark-muted); font-size: var(--text-sm); text-align: center; }
.back-site:hover { color: var(--color-on-dark); text-decoration: underline; }
.back-arrow { transform: rotate(180deg); flex: none; }
:is(input, button, a):focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.back-site:focus-visible { outline-color: var(--color-on-dark); }
@media (max-width: 480px) {
  .login-card { padding: var(--space-6) min(var(--space-5), 5vw); }
  .brand-row { align-items: flex-start; }
  .input-wrap .prefix { display: none; }
  .code-wrap { flex-direction: column; }
  .code-btn { border-left: 0; border-top: 1px solid var(--color-border); }
}
@media (prefers-reduced-motion: reduce) { .code-btn { transition: none; } }
</style>
