<script setup>
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: 'chart' },
  label: { type: String, required: true },
  value: { type: String, default: '—' },
  hint: { type: String, default: '' },
})
</script>

<template>
  <div class="card stat">
    <div class="stat-top">
      <span class="stat-ic"><Icon :name="icon" :size="20" /></span>
      <span class="stat-label">{{ label }}</span>
    </div>
    <p class="stat-value" :aria-label="value === '—' ? '暂无数据' : undefined">{{ value }}</p>
    <p v-if="hint" class="stat-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.stat { min-width: 0; padding: var(--space-5); overflow-wrap: anywhere; }
.stat-top { display: flex; align-items: center; gap: var(--space-2); }
.stat-ic { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: none; border-radius: var(--radius-sm); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); }
.stat-label { min-width: 0; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); }
.stat-value { font-size: var(--text-3xl); line-height: 1.3; font-weight: 700; margin-top: var(--space-3); font-variant-numeric: tabular-nums; }
.stat-hint { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-1); }
</style>
