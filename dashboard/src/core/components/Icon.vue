<script setup>
/** 唯一图标清单由 design-system/icons.json 生成；图标名称不可来自用户 HTML。 */
import { ICONS, ICON_VIEWBOX, ICON_STROKE, ICON_FALLBACK } from './icons.generated'
defineProps({
  name: { type: String, default: 'grid' },
  size: { type: [Number, String], default: 24 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="ICON_VIEWBOX"
    fill="none"
    stroke="currentColor"
    :stroke-width="ICON_STROKE"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="ICONS[name] || ICONS[ICON_FALLBACK]"
  />
</template>
