# 登录与授权流程 · 风险与缺口（flow-risks-and-gaps）

> 生成：2026-10-16 · 基于 commit 6819374 · 场景技能：`flow-visualizer`
> 定位：记录流程中**未证实/平台黑盒/边缘行为**，不做整体架构评审（那是 `risk-quality-reviewer` 的职责）。

## 平台黑盒（仓库内不可见，依赖腾讯云行为）

| 项 | 说明 | 验证方式 |
| --- | --- | --- |
| 短信下发与验证码校验 | signInWithSms 的校验、验证码有效期、防刷（频率/日限额）均由 CloudBase 身份验证承担；仓库只见调用点与错误翻译 | 控制台「身份验证」配置 + 实测 |
| 首次登录自动注册 | “未注册手机号自动建号”来自 `useAuth.js` 注释与页面文案，账号创建行为本身在平台侧 | 控制台用户目录实测 |
| 用户目录一致性 | bootstrap 依赖 describeUserList 能查到手机号 → 用户必须先登录过一次；跨系统数据一致性无仓库内保证 | 实测先登录再 bootstrap |

## 待验证声明

| 项 | 现状 | 建议 |
| --- | --- | --- |
| user_roles 表访问控制 | 「未对 anon/authenticated 授权、前端无法直访」仅为代码注释与 wiki 声明 | CloudBase 控制台 → PostgreSQL → 核验表授权 |
| 控制台手工改数 | 若有人在控制台直改 user_roles，可绕过云函数校验（无法从仓库排除） | 运维约定 + 定期核对 |

## 边缘行为（代码已证实，但值得知晓）

1. **守卫 3 秒双超时**（`router.js:61-69`）：登录态恢复超 3 秒按未登录处理踢到 /login；角色加载超 3 秒则**带当前 roles 继续放行**——若 roles 仍为空而目标分区需要角色，用户会被拒到 /no-access（低概率：loadRoles 的 finally 保证 rolesLoaded 必然置位，仅网络挂起时触发）。
2. **me 动作全表扫描**：每次读取先 `SELECT ... LIMIT 200` 全量再在函数内 find 本人（`index.js:97-143`）。当前规模无碍；用户数接近 200 时授权列表会截断（list 动作同样受 LIMIT 200 限制），me 亦可能因本人记录排在 200 条之外而读不到 → 静默降级为消费者。属于规模增长后的已知上限。
3. **CLI 路径硬编码**：`set-super-admin.mjs:14` 硬编码 `C:/Program Files/nodejs/node_modules/@cloudbase/cli/bin/tcb`，换机或 npm 全局路径不同会导致 bootstrap 失败（报错可读，重试成本低）。
4. **SDK 事件环规避**是硬约束（`useAuth.js:70-81` 注释）：后续改造切勿在 onLoginStateChanged 回调内调用凭据读取 API，否则主线程卡死（已在真实 Chrome 复现过）。

## 未覆盖范围

- 业务闭环（生产→入库→预约→审计）尚未实现（占位页），无流程可画；补充业务后需新增对应流程图。
- 项目无线上日志/trace，本流程图为静态代码推演，未做运行时验证。
