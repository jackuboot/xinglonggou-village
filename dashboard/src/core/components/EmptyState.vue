<script setup>
/**
 * 规划功能空状态：不把占位内容呈现为实际业务数据。
 * 与角色首页同一套区块语言（标签 + 标题 + 引言 + 说明），不做浮起卡片。
 */
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: 'spark' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  chips: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="empty">
    <p class="empty-tags">
      <span class="empty-mark"><Icon :name="icon" :size="24" /></span>
      <span class="empty-state">即将上线</span>
    </p>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="desc" class="page-lead">{{ desc }}</p>
    <ul v-if="chips.length" class="empty-chips">
      <li v-for="c in chips" :key="c">{{ c }}</li>
    </ul>
    <p class="section-note">该功能正在开发，页面先占位；上线前这里不会有可操作内容。</p>
  </section>
</template>

<style scoped>
.empty { max-width: 40rem; min-width: 0; overflow-wrap: anywhere; }
.empty-tags { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
.empty-mark { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; border-radius: var(--radius-md); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); }
.empty-state { display: inline-flex; padding: var(--space-1) var(--space-3); border-radius: var(--radius-xs); font-size: var(--text-xs); font-weight: 600; color: var(--color-accent-ink); background: var(--color-accent-soft); }
h1 { margin-top: var(--space-3); }
.empty-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-5); }
.empty-chips li { max-width: 100%; padding: var(--space-1) var(--space-3); border-radius: var(--radius-xs); font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-surface-muted); }
</style>
