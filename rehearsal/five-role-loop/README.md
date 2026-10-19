# 五角色最小闭环（five-role-loop）

> 目的：验证五角色分工、RBAC/ABAC、跨角色交接、审计与主动 Agent 边界。
> 业务：农户提交蔬菜批次 → 入库员审核并建批次 → 消费者溯源并购买 → 审计员核查 → 管理员看全局。
> 性质：最小实现，不是生产代码；AI 动作为规则模拟。

## 角色与工具范围

| 角色 | 允许工具 | 数据范围 |
| --- | --- | --- |
| 农户 farmer | `produce.submit`、`produce.list` | 本人 |
| 入库员 keeper | `produce.review`、`batch.create`、`batch.list` | 本村 |
| 消费者 consumer | `trace.list`、`trace.query`、`booking.create` | 公开/本人 |
| 审计员 auditor | `audit.query`、`alert.list`、`alert.ack` | 全量只读 |
| 管理员 admin | `produce.review`、`audit.query`、`system.status`、`alert.scan` | 全量 |

跨角色调用一律拒绝并写 `access.denied` 审计。

## 业务动作 vs 助手

| 角色 | 真实业务动作（核心） | 助手用途（附加） |
| --- | --- | --- |
| 农户 | 提交蔬菜批次（写） | 查询自己名下蔬菜 |
| 入库员 | 审核蔬菜、创建批次（写） | 查看本村批次 |
| 消费者 | 溯源查询、创建购买（写） | 浏览可溯源蔬菜 |
| 审计员 | 审计查询、告警确认 | 汇总审计事件 |
| 管理员 | 系统状态、触发预警扫描 | 汇总系统统计 |

助手不是业务本身，只是同一工具网关上的查询/解释层。

## 主动 Agent（审核 / 预警 / 调度）

| Agent | 主动做什么 | 写入边界 |
| --- | --- | --- |
| 审核 Agent | 读取待审蔬菜批次，给出通过/驳回建议、置信度与理由；申报数量 >500kg 建议驳回 | **不写状态**；人工调用 `produce.review` 后生效 |
| 预警哨兵 | 扫描待审蔬菜、无购买批次、未派单预约，生成告警并按 `dedupeKey` 去重 | 写入 `Alert`（低风险），审计员确认后关闭 |
| 调度 Agent | 根据预约与批次所在村，建议本村入库员承接履约 | **不写 assignedTo**；人工调用 `dispatch.assign` 后生效 |

所有 AI 调用在审计中带 `agentId`，人工确认不带，便于区分“谁提议、谁拍板”。

## 角色助手

- 农户助手 → `produce.list`
- 入库员助手 → `batch.list`
- 消费者助手 → `trace.list`
- 审计员助手 → `audit.query`
- 管理员助手 → `system.status`

回答是确定性模板，用于验证工具范围与数据边界，不代表真实 LLM 能力。

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
- ABAC：入库员只能操作本村蔬菜批次；
- 公开视图：溯源不返回 `farmerUid` 等敏感字段；
- 审计：成功与拒绝都留痕；
- 主动 Agent：审核建议、预警扫描、调度建议，关键写入必须人工确认；
- 最小闭环：五个角色各至少参与一次。

## 仍是模拟

- 无真实 UI、无短信登录；
- 无真实数据库（内存存储）；
- 无真实模型/ASR；
- 未部署 CloudBase；
- 审计事件未接 trace/看板。
