/**
 * 当前用户授权读取（前端唯一角色数据入口）。
 * 走云函数 roles-admin 的 me action：云函数只返回调用者本人的授权数据；
 * users 集合由云函数自动创建与维护，前端不直接访问数据库，
 * 因此无需在控制台建集合、也无需配置集合权限规则。
 */
import { callFunction } from './cloudbase'

/**
 * 读取当前用户的授权角色列表。
 * - 无记录 / 数据库未开通 / 调用异常：返回 []（兜底最低权限，绝不放大权限）
 * @returns {Promise<string[]>}
 */
export async function getGrantedRoles() {
  try {
    const res = await callFunction('roles-admin', { action: 'me' })
    const data = res && res.ok ? res.data : null
    return data && Array.isArray(data.roles) ? data.roles : []
  } catch (e) {
    return []
  }
}
