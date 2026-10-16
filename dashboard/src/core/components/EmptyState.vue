<script setup>
import Icon from './Icon.vue'

/** 功能占位空状态：图标 + 标题 + 描述 + 规划要点 chips */
defineProps({
  icon: { type: String, default: 'spark' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  chips: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="card empty">
    <span class="empty-ic"><Icon :name="icon" :size="30" /></span>
    <h2>{{ title }}</h2>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <div v-if="chips.length" class="empty-chips">
      <span v-for="c in chips" :key="c" class="chip">{{ c }}</span>
    </div>
    <p class="empty-note">此页面为外框架占位 · 功能规划确定后在此填充</p>
  </div>
</template>

<style scoped>
.empty { padding: 56px 28px; text-align: center; }
.empty-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 22px;
  background: var(--brand-soft);
  color: var(--brand);
  margin-bottom: 18px;
}
h2 { font-size: 20px; font-weight: 700; }
.empty-desc { color: var(--muted); font-size: 14px; max-width: 420px; margin: 10px auto 0; }
.empty-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 18px; }
.empty-note { margin-top: 26px; font-size: 12.5px; color: #93a49b; }
</style>
