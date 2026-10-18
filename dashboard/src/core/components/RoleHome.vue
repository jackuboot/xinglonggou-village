<script setup>
/**
 * 角色首页骨架：统一「你在闭环里的位置 + 本区功能」两段，入口与文案由各角色传入。
 * 细线功能行等区块样式在 core/styles/base.css 中共用；不摆无数据的空指标卡，
 * 未上线的功能以文字标签标注，入口保持可达（点进占位页）。
 */
import { computed } from 'vue'
import Icon from './Icon.vue'
import { CHAIN_STEPS } from '@/core/chain'

const props = defineProps({
  role: { type: Object, required: true },
  section: { type: String, default: '' },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  note: { type: String, default: '本区业务功能正在开发；账号信息与用户 UID 在「我的」里查看与复制。' },
  links: { type: Array, default: () => [] },
})

/** 该角色在闭环中的位置；管理后台不在闭环内，则不显示上下游。 */
const chainIndex = computed(() => CHAIN_STEPS.findIndex(step => step.id === props.role.id))
const prevStep = computed(() => (chainIndex.value > 0 ? CHAIN_STEPS[chainIndex.value - 1] : null))
const nextStep = computed(() => (chainIndex.value >= 0 && chainIndex.value < CHAIN_STEPS.length - 1 ? CHAIN_STEPS[chainIndex.value + 1] : null))
</script>

<template>
  <div class="page">
    <p class="page-kicker">{{ role.name }}<template v-if="section"> · {{ section }}</template></p>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="summary" class="page-lead">{{ summary }}</p>

    <section v-if="chainIndex >= 0" class="page-section" :aria-labelledby="`chain-heading-${role.id}`">
      <h2 :id="`chain-heading-${role.id}`" class="section-label">闭环里的位置</h2>
      <ol class="chain">
        <li
          v-for="step in CHAIN_STEPS"
          :key="step.id"
          class="chain-item"
          :class="{ on: step.id === role.id }"
          :aria-current="step.id === role.id ? 'step' : undefined"
        >
          <span class="chain-no">{{ step.index }}</span>
          <span class="chain-name">{{ step.name }}</span>
          <span class="chain-act">{{ step.action }}</span>
        </li>
      </ol>
      <p class="chain-flow">
        <span>上一环：{{ prevStep ? `${prevStep.name} · ${prevStep.action}` : '你的环节是起点' }}</span>
        <span>下一环：{{ nextStep ? `${nextStep.name} · ${nextStep.action}` : '你的环节是终点' }}</span>
      </p>
    </section>

    <section class="page-section" :aria-labelledby="`func-heading-${role.id}`">
      <h2 :id="`func-heading-${role.id}`" class="section-label">本区功能</h2>
      <ul class="row-list">
        <li v-for="item in links" :key="item.to">
          <router-link class="row-link" :to="item.to">
            <span class="row-icon"><Icon :name="item.icon" :size="20" /></span>
            <span class="row-body">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
            <span class="row-tag">即将上线</span>
            <span class="row-arrow" aria-hidden="true"><Icon name="arrowRight" :size="20" /></span>
          </router-link>
        </li>
      </ul>
      <p v-if="note" class="section-note">{{ note }}</p>
    </section>
  </div>
</template>

<style scoped>
/* 闭环链路：窄屏两列、宽屏四列；当前环节同时用字重、下划线与底色表示，不靠颜色单独表达 */
.chain { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); margin-top: var(--space-4); }
.chain-item { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--space-2); align-items: baseline; padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }
.chain-no { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.chain-name { justify-self: start; min-width: 0; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); }
.chain-act { grid-column: 2; font-size: var(--text-xs); color: var(--color-text-muted); }
.chain-item.on { border-color: var(--role-accent); background: var(--role-accent-soft); }
.chain-item.on .chain-name { color: var(--role-accent-ink); font-weight: 700; }
.chain-item.on .chain-name::after { content: ""; display: block; height: 2px; margin-top: 2px; background: var(--role-accent); }
.chain-flow { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-6); margin-top: var(--space-4); font-size: var(--text-xs); color: var(--color-text-muted); }

@media (min-width: 600px) {
  .chain { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
