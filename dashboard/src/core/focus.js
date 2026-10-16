/** 仅管理展示层焦点，不写 URL hash（工作台使用 hash 路由）。 */
export function focusMainContent(trigger) {
  const main = document.querySelector('main')
  if (!main) return
  main.setAttribute('tabindex', '-1')
  main.focus({ preventScroll: trigger?.type !== 'click' })
}
