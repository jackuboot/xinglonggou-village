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
      <span class="stat-ic"><Icon :name="icon" :size="18" /></span>
      <span class="stat-label">{{ label }}</span>
    </div>
    <p class="stat-value">{{ value }}</p>
    <p v-if="hint" class="stat-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.stat { padding: 18px 20px; }
.stat-top { display: flex; align-items: center; gap: 8px; }
.stat-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--brand);
}
.stat-label { font-size: 13px; font-weight: 600; color: var(--muted); }
.stat-value { font-size: 28px; font-weight: 700; margin-top: 10px; letter-spacing: 0.02em; }
.stat-hint { font-size: 12px; color: #93a49b; margin-top: 2px; }
</style>
