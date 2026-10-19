# 五角色最小闭环（five-role-loop）

> 目的：验证蓝图的五角色分工、RBAC/ABAC、跨角色交接、审计与角色 Agent 工具范围，而不是只做一个角色。
> 性质：最小实现，不是生产代码；AI 助手为确定性模拟。

## 业务闭环

```
农户提交地块 → 入库员审核并建批次 → 消费者溯源并预约
→ 审计员查询审计并核查 → 管理员查看全局状态
```

## 角色与工具范围

| 角色 | 允许工具 | 数据范围 |
| --- | --- | --- |
| 农户 farmer | `plot.submit`、`plot.list` | 本人 |
| 入库员 keeper | `plot.review`、`batch.create`、`batch.list` | 本村 |
| 消费者 consumer | `trace.list`、`trace.query`、`booking.create` | 公开/本人 |
| 审计员 auditor | `audit.query` | 全量只读 |
| 管理员 admin | `plot.review`、`audit.query`、`system.status` | 全量 |

跨角色调用一律拒绝并写 `access.denied` 审计。

## 角色助手

每个角色有一个最小助手，只能调用自己的工具：

- 农户助手 → `plot.list`
- 入库员助手 → `batch.list`
- 消费者助手 → `trace.list`
- 审计员助手 → `audit.query`
- 管理员助手 → `system.status`

回答是确定性模板，用于验证**工具范围与数据边界**，不代表真实 LLM 能力。

## 运行

```bash
cd rehearsal/five-role-loop
npm install
npm test
npm run typecheck
npm run demo
```

## 覆盖的架构约束

- RBAC：角色不在允许列表 → 拒绝；
- ABAC：入库员只能操作本村地块/批次；
- 公开视图：溯源不返回 `ownerUid` 等敏感字段；
- 审计：成功与拒绝都留痕；
- 角色 Agent：每个助手只能调用自己的工具；
- 最小闭环：五个角色各至少参与一次。

## 仍是模拟

- 无真实 UI、无短信登录；
- 无真实数据库（内存存储）；
- 无真实模型/ASR；
- 未部署 CloudBase；
- 审计事件未接 trace/看板。
