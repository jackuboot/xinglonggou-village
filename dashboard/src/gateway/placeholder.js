/**
 * 通用占位子页工厂：按 meta.title / meta.hint 渲染「功能建设中」空状态。
 * 组件懒加载，保证占位页代码同样按需下载。
 */
export const placeholder = (title, hint) => ({
  component: () => import('./RolePlaceholder.vue'),
  meta: { title, hint },
})
