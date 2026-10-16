<script setup>
/** 角色首页展示骨架；角色信息、入口和业务仍由各工作台提供。 */
import Icon from './Icon.vue'
import StatCard from './StatCard.vue'

defineProps({
  role: { type: Object, required: true },
  tagline: { type: String, default: '' },
  stats: { type: Array, default: () => [] },
  links: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="page" :data-role="role.id">
    <div class="card hero">
      <span class="hero-ic"><Icon :name="role.icon" :size="28" /></span>
      <div class="hero-text">
        <h1>{{ role.name }}概览</h1>
        <p>{{ tagline || role.desc }}</p>
      </div>
    </div>

    <div v-if="stats.length" class="stats">
      <StatCard v-for="s in stats" :key="s.label" v-bind="s" />
    </div>

    <section v-if="links.length" class="quick" aria-label="功能入口">
      <h2>功能入口</h2>
      <router-link v-for="l in links" :key="l.to" :to="l.to" class="card quick-item">
        <span class="quick-ic"><Icon :name="l.icon" :size="20" /></span>
        <span class="quick-text">
          <strong>{{ l.title }}</strong>
          <small>{{ l.desc }}</small>
          <span class="coming">即将上线</span>
        </span>
        <Icon name="arrowRight" :size="20" class="quick-arrow" />
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.page { min-width: 0; overflow-wrap: anywhere; }
.hero { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-6); background: linear-gradient(120deg, var(--color-surface) 55%, var(--role-accent-soft, var(--color-primary-soft))); }
.hero-ic { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); flex: none; }
.hero-text { min-width: 0; }
.hero-text h1 { font-size: var(--text-2xl); line-height: 1.4; font-weight: 700; }
.hero-text p { color: var(--color-text-muted); font-size: var(--text-sm); margin-top: var(--space-2); line-height: 1.7; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
.quick { display: grid; gap: var(--space-3); margin-top: var(--space-6); }
.quick h2 { font-size: var(--text-lg); }
.quick-item { display: flex; align-items: center; gap: var(--space-3); min-width: 0; min-height: var(--control-height); padding: var(--space-4) var(--space-5); transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard); }
.quick-item:hover { border-color: var(--role-accent, var(--color-primary)); box-shadow: var(--shadow-md); }
.quick-item:active { background: var(--color-surface-muted); }
.quick-item:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.quick-ic { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--role-accent-soft, var(--color-primary-soft)); color: var(--role-accent-ink, var(--color-primary)); flex: none; }
.quick-text { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); min-width: 0; flex: 1; }
.quick-text strong { font-size: var(--text-base); }
.quick-text small { color: var(--color-text-muted); font-size: var(--text-sm); }
.coming { font-size: var(--text-xs); color: var(--color-text-muted); }
.quick-arrow { color: var(--color-text-muted); flex: none; }
@media (max-width: 480px) {
  .hero { align-items: flex-start; flex-direction: column; padding: var(--space-5); }
  .quick-item { padding: var(--space-4); gap: var(--space-2); }
}
@media (prefers-reduced-motion: reduce) { .quick-item { transition: none; } }
</style>
