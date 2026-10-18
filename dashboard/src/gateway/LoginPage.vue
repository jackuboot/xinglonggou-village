<script setup>
/**
 * 登录页：左侧品牌说明，右侧纸面表单。
 * 登录参数、发送验证码与校验流程保持不变；只改版式与信息层级。
 */
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/core/components/Icon.vue'
import { useAuth } from '@/core/composables/useAuth'
import { defaultHome } from '@/core/roles'
import { CHAIN_STEPS } from '@/core/chain'
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
    <section class="brand-panel">
      <span class="mark"><Icon name="leaf" :size="22" /></span>
      <p class="bp-name">{{ BRAND.name }}{{ BRAND.product }}</p>
      <p class="bp-slogan">{{ BRAND.slogan }}</p>
      <div class="bp-chain">
        <p class="bp-label">本村闭环</p>
        <ol>
          <li v-for="step in CHAIN_STEPS" :key="step.id">
            <span>{{ step.name }}</span><em>{{ step.action }}</em>
          </li>
        </ol>
        <p class="bp-note">统一用手机号登录，进入后按身份进入对应工作台。</p>
      </div>
    </section>

    <section class="form-panel">
      <div class="form-col">
        <p class="page-kicker">登录</p>
        <h1 class="page-title">登录工作台</h1>
        <p class="page-lead">使用手机号登录，进入你的工作台。</p>
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
        <p class="agreement">未注册的手机号验证通过后将自动创建账号。</p>

        <p class="back-row">
          <a class="back-site" :href="SITE_URL"><span class="back-arrow" aria-hidden="true"><Icon name="arrowRight" :size="16" /></span>返回 {{ BRAND.name }}官网</a>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login { min-width: 0; min-height: 100vh; min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr); background: var(--color-canvas); overflow-wrap: anywhere; }

/* 品牌栏：说明这是什么系统、有哪些身份；窄屏收成一条紧凑页头 */
.brand-panel { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-6) var(--space-5); background: var(--color-primary-deep); color: var(--color-on-dark); }
.mark { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex: none; margin-bottom: var(--space-2); border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-primary-deep); }
.bp-name { font-size: var(--text-lg); font-weight: 700; }
.bp-slogan { font-size: var(--text-sm); color: var(--color-on-dark-muted); }
.bp-chain { display: none; }

.form-panel { display: flex; justify-content: center; padding: var(--space-8) var(--space-5) var(--space-10); }
.form-col { width: min(26rem, 100%); min-width: 0; }
.form-col form { margin-top: var(--space-6); }
.alert { margin-top: var(--space-4); }

.code-btn { min-height: var(--control-height); padding: var(--space-3); flex: 0 0 auto; border-left: 1px solid var(--color-border); color: var(--color-primary); font-size: var(--text-sm); font-weight: 600; white-space: normal; transition: color var(--duration-fast) var(--ease-standard), background-color var(--duration-fast) var(--ease-standard); }
.code-btn:not(:disabled):hover { color: var(--color-primary-hover); background: var(--color-primary-soft); }
.code-btn:disabled { color: var(--color-text-muted); cursor: not-allowed; }
.login-btn { margin-top: var(--space-2); white-space: normal; }
.request-status { font-size: var(--text-sm); color: var(--color-primary); }
.request-status:not(:empty) { margin-top: var(--space-3); }
.agreement { margin-top: var(--space-3); font-size: var(--text-xs); line-height: 1.7; color: var(--color-text-muted); }
.back-row { margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--color-border); }
.back-site { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--control-height); font-size: var(--text-sm); font-weight: 600; color: var(--color-primary); }
.back-arrow { display: inline-flex; transform: rotate(180deg); }
.back-arrow svg { width: 16px; height: 16px; }

@media (min-width: 900px) {
  .login { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); }
  .brand-panel { justify-content: center; gap: var(--space-3); padding: var(--space-12) clamp(var(--space-8), 4vw, var(--space-16)); }
  .bp-name { font-size: var(--text-xl); }
  .bp-chain { display: block; margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--color-overlay-border); }
  .bp-label { font-size: var(--text-xs); letter-spacing: 0.1em; color: var(--color-on-dark-subtle); }
  .bp-chain ol { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-3); }
  .bp-chain li { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); font-size: var(--text-sm); color: var(--color-on-dark); }
  .bp-chain em { font-style: normal; font-size: var(--text-xs); color: var(--color-on-dark-muted); }
  .bp-note { max-width: 22rem; margin-top: var(--space-5); font-size: var(--text-xs); line-height: 1.75; color: var(--color-on-dark-muted); }
  .form-panel { align-items: center; padding: var(--space-12) clamp(var(--space-8), 5vw, var(--space-16)); }
}

@media (max-width: 480px) {
  .brand-panel { padding: var(--space-5) var(--space-4); }
  .form-panel { padding: var(--space-6) var(--space-4) var(--space-8); }
  .mark { width: 36px; height: 36px; margin-bottom: var(--space-1); }
  .input-wrap .prefix { display: none; }
  .code-wrap { flex-direction: column; }
  .code-btn { border-left: 0; border-top: 1px solid var(--color-border); }
}

@media (prefers-reduced-motion: reduce) { .code-btn { transition: none; } }
</style>
