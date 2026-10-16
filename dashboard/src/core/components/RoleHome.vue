<script setup>
/**
 * 角色工作台首页通用骨架：角色横幅 + 数据卡片 + 快捷入口。
 * 各角色首页（pages/{role}/*Home.vue）以薄包装传入差异化内容。
 */
import Icon from './Icon.vue'
import StatCard from './StatCard.vue'

defineProps({
  role: { type: Object, required: true },   // ROLES[id] 角色元数据
  tagline: { type: String, default: '' },   // 该角色在业务闭环中的定位说明
  stats: { type: Array, default: () => [] },  // [{ icon, label, value, hint }]
  links: { type: Array, default: () => [] },  // [{ to, icon, title, desc }]
})
</script>

<template>
  <div class="page">
    <div class="card hero">
      <span class="hero-ic"><Icon :name="role.icon" :size="26" /></span>
      <div class="hero-text">
        <h2>{{ role.name }}工作台</h2>
        <p>{{ tagline || role.desc }}</p>
      </div>
    </div>

    <div v-if="stats.length" class="stats">
      <StatCard v-for="s in stats" :key="s.label" v-bind="s" />
    </div>

    <div v-if="links.length" class="quick">
      <router-link
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="card quick-item"
      >
        <span class="quick-ic"><Icon :name="l.icon" :size="20" /></span>
        <span class="quick-text">
          <strong>{{ l.title }}</strong>
          <small>{{ l.desc }}</small>
        </span>
        <Icon name="arrowRight" :size="16" class="quick-arrow" />
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 26px;
  background: linear-gradient(135deg, #ffffff 58%, var(--brand-soft));
}
.hero-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(145deg, var(--brand), var(--brand-dark));
  color: #dff0e4;
  flex: none;
}
.hero-text h2 { font-size: 19px; font-weight: 700; }
.hero-text p { color: var(--muted); font-size: 13.5px; margin-top: 3px; line-height: 1.55; }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.quick { display: grid; gap: 12px; margin-top: 16px; }
.quick-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}
.quick-item:hover { border-color: var(--brand); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.quick-ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--brand-soft);
  color: var(--brand);
  flex: none;
}
.quick-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.quick-text strong { font-size: 15px; }
.quick-text small { color: var(--muted); font-size: 12.5px; margin-top: 1px; }
.quick-arrow { color: #9aaba1; flex: none; }
.quick-item:hover .quick-arrow { color: var(--brand); }
</style>
