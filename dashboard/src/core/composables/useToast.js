/** 全局轻提示（toast）：任意组件 import { toast } 即可弹出 */
import { reactive } from 'vue'

const state = reactive({ msg: '', show: false })
let timer = null

function toast(msg) {
  state.msg = msg
  state.show = true
  clearTimeout(timer)
  timer = setTimeout(() => { state.show = false }, 2200)
}

export function useToast() {
  return { state, toast }
}
