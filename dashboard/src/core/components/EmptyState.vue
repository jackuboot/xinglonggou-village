<script setup>
import Icon from './Icon.vue'

/** 规划功能空状态，不把占位内容呈现为实际业务数据。 */
defineProps({
  icon: { type: String, default: 'spark' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  chips: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="card empty">
    <span class="empty-ic"><Icon :name="icon" :size="32" /></span>
    <h1>{{ title }}</h1>
    <p class="empty-status">即将上线</p>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <div v-if="chips.length" class="empty-chips" aria-label="规划功能">
      <span v-for="c in chips" :key="c" class="chip">{{ c }}</span>
    </div>
    <p class="empty-note">功能正在准备中，当前暂无可操作内容。</p>
  </section>
</template>

<style scoped>
.empty { min-width: 0; padding: var(--space-12) var(--space-6); text-align: center; overflow-wrap: anywhere; }
.empty-ic { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--radius-lg); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); margin-bottom: var(--space-5); }
h1 { font-size: var(--text-2xl); line-height: 1.4; font-weight: 700; }
.empty-status { display: inline-block; margin-top: var(--space-3); padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); color: var(--role-accent-ink, var(--color-primary)); background: var(--role-accent-soft, var(--color-primary-soft)); font-size: var(--text-sm); font-weight: 600; }
.empty-desc { color: var(--color-text-muted); font-size: var(--text-base); max-width: 32rem; margin: var(--space-4) auto 0; line-height: 1.7; }
.empty-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; margin-top: var(--space-5); }
.chip { max-width: 100%; white-space: normal; font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-surface-muted); }
.empty-note { margin-top: var(--space-6); font-size: var(--text-xs); color: var(--color-text-muted); }
@media (max-width: 480px) { .empty { padding: var(--space-8) var(--space-4); } }
</style>
