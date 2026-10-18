/**
 * 业务闭环的界面展示信息（只用于说明「你在闭环里的位置」，不参与任何权限判断）。
 *
 * 顺序取 roles.js 的 ROLE_ORDER，角色名取 ROLES，避免与权限数据各写一份。
 * 环节动作沿用 roles.js 顶部注释与各角色说明里的措辞：产生 → 记录 → 使用 → 核查。
 */
import { ROLES, ROLE_ORDER } from '@/core/roles'

const ACTIONS = {
  farmer: '产生',
  keeper: '记录',
  consumer: '使用',
  auditor: '核查',
}

export const CHAIN_STEPS = ROLE_ORDER.map((id, index) => ({
  id,
  index: index + 1,
  name: ROLES[id].name,
  action: ACTIONS[id] || ROLES[id].desc,
}))
