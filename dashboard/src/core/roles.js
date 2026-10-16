/**
 * 角色与工作台定义（唯一数据源：代码与数据库 user_roles.roles 字段共用这些标识）。
 *
 * 商品与服务闭环：
 *   农户生产(产生) → 入库员入库/代理(记录) → 消费者预约使用(使用) → 审计员核查(审计)
 *
 * 角色存储模型（PostgreSQL user_roles 表，读写见 db.js / admin.js）：
 * - 新用户无记录 = 消费者（隐式默认，所有登录用户可用）
 * - farmer / keeper / auditor / admin 为授权角色：在管理后台「用户授权管理」中授予
 *   （走云函数 roles-admin）；首位超级管理员在部署时设置（bootstrap，见部署脚本）
 * - 支持一人多角色（roles 数组），登录后统一进入选择工作台页
 *
 * 工作台隔离：四个业务角色 + 管理后台各自拥有独立的应用界面
 * （独立 Shell 布局与独立路由分区，见 layouts/ 下五个 Shell；
 * 调整某个角色的布局不影响其他角色）。
 */

export const ROLES = {
  farmer: {
    id: 'farmer',
    name: '农户',
    icon: 'leaf',
    home: '/farmer',
    desc: '生产和提供服务',
    shellTitle: '农户工作台',
  },
  keeper: {
    id: 'keeper',
    name: '入库员',
    icon: 'inbox',
    home: '/keeper',
    desc: '农产品入库与代理发布',
    shellTitle: '入库员工作台',
  },
  consumer: {
    id: 'consumer',
    name: '消费者',
    icon: 'cart',
    home: '/consumer',
    desc: '预约、使用、跟踪服务和农产',
    shellTitle: '消费者工作台',
  },
  auditor: {
    id: 'auditor',
    name: '审计员',
    icon: 'shield',
    home: '/auditor',
    desc: '独立审计与数据核查',
    shellTitle: '审计工作台',
  },
  admin: {
    id: 'admin',
    name: '管理后台',
    icon: 'settings',
    home: '/admin',
    desc: '用户授权与系统管理',
    shellTitle: '管理后台',
  },
}

/** 管理员权限标识（云函数授权值；同时拥有独立管理后台） */
export const ADMIN_ROLE = 'admin'

/** 展示与排序顺序（生产 → 记录 → 使用 → 审计；admin 不参与闭环排序） */
export const ROLE_ORDER = ['farmer', 'keeper', 'consumer', 'auditor']

/** 工作台顺序（四业务角色 + 管理后台居末） */
export const WORKSPACE_ORDER = [...ROLE_ORDER, ADMIN_ROLE]

export function isValidRole(id) {
  return Object.prototype.hasOwnProperty.call(ROLES, id)
}

/** 是否拥有管理员权限 */
export function hasAdminRole(roles) {
  return Array.isArray(roles) && roles.includes(ADMIN_ROLE)
}

/**
 * 计算有效角色：数据库授权的角色 + 隐式消费者，按 ROLE_ORDER 排序，
 * 管理员标识（admin）保留在数组末尾（不参与四角色闭环排序）。
 * @param {string[]} granted 数据库 user_roles.roles 读取结果
 */
export function effectiveRoles(granted) {
  const set = new Set(['consumer'])
  if (Array.isArray(granted)) {
    for (const id of granted) {
      if (isValidRole(id)) set.add(id)
    }
  }
  const roles = ROLE_ORDER.filter(id => set.has(id))
  if (set.has(ADMIN_ROLE)) roles.push(ADMIN_ROLE)
  return roles
}

/** 用户可进入的工作台列表（含管理后台，角色元数据数组） */
export function availableWorkspaces(roles) {
  const set = new Set(Array.isArray(roles) ? roles : [])
  return WORKSPACE_ORDER.filter(id => set.has(id)).map(id => ROLES[id])
}

/**
 * 工作台体系默认入口：统一先到选择工作台页，选身份后再进入对应工作台；
 * 仅在异常态（无任何有效角色）回登录页。
 */
export function defaultHome(roles) {
  const workspaces = availableWorkspaces(roles)
  return workspaces.length ? '/select' : '/login'
}
