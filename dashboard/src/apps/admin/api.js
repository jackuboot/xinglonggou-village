/**
 * 用户授权管理 API（走云函数 roles-admin）。
 * 前端无直写 users 集合的能力（安全规则 write:false），
 * 所有授权写操作均由云函数校验管理员身份后执行。
 */
import { callFunction } from '@/core/cloudbase'

const FN = 'roles-admin'

async function invoke(payload) {
  const res = await callFunction(FN, payload)
  if (!res || typeof res !== 'object') throw new Error('云函数响应格式异常')
  if (res.ok !== true) {
    throw Object.assign(new Error(res.message || '操作失败'), { code: res.code })
  }
  return res.data
}

/** 系统状态：{ total, hasAdmin, isAdmin, firstRun, hasUid } */
export function fetchAdminStatus() {
  return invoke({ action: 'status' })
}

/** [admin] 授权/更新用户角色 { uid, roles, name } */
export function grantUserRoles(uid, roles, name) {
  return invoke({ action: 'grant', uid, roles, name })
}

/** [admin] 撤销用户全部授权（删除记录，该用户退回默认消费者） */
export function revokeUser(uid) {
  return invoke({ action: 'revoke', uid })
}

/** [admin] 用户授权列表 */
export function fetchUserList() {
  return invoke({ action: 'list' })
}
