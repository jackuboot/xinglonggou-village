# 五角色业务闭环 · 事件预演文本

> 用途：用一条完整的时间线，说明五角色和 AI 在业务闭环里**各自做什么、发什么事件、谁拍板、失败怎么走**。
> 对应实现：`rehearsal/five-role-loop/`。本文是叙事文本，不是接口文档。

## 一、出场角色

| 角色/Agent | 身份 | 在闭环中的职责 |
| --- | --- | --- |
| 李桂芳 | 农户 farmer | 提交地块、查看自己的地块 |
| 王入库 | 入库员 keeper | 审核地块、创建批次、确认派单 |
| 张顾客 | 消费者 consumer | 查溯源、创建预约 |
| 赵审计 | 审计员 auditor | 查审计事件、确认告警 |
| 孙管理员 | 管理员 admin | 看全局状态、执行预警扫描 |
| review-agent | 审核 Agent | 读地块，给通过/驳回建议（不写状态） |
| alert-sentinel | 预警哨兵 | 扫描异常，生成告警（低风险写） |
| dispatcher | 调度 Agent | 读预约与批次，建议履约人（不写派单） |
| 各角色助手 | 角色 Agent | 只调用本角色工具做查询和解释 |

## 二、时间线（正常闭环）

### 事件 1 · 农户提交地块

李桂芳打开工作台，提交：“3 组，5 亩，茶”。

- 调用：`plot.submit`；
- 网关校验：角色 farmer ✓，数据范围本人 ✓，schema 合法 ✓；
- 写入：地块 `status = submitted`，记录 `submittedAt`；
- 审计事件：`plot.submitted`（actor=李桂芳）；
- 此时消费者看不到这块地，它只是待审数据。

### 事件 2 · 审核 Agent 先给建议

系统为待审地块调用 review-agent。

- Agent 读取地块：`review.suggest`；
- 输出：`recommendation = approve`，`confidence = 0.9`，理由“字段完整、面积在常见范围”；
- 审计事件：`review.suggested`，带 `agentId = review-agent`；
- **关键**：地块状态仍是 `submitted`，Agent 没有写权限。

如果面积是 80 亩，Agent 会改为建议 `reject`，理由“面积超过 50 亩，请核对承包合同”，置信度 0.82。

### 事件 3 · 入库员拍板审核

王入库看到建议，决定通过。

- 调用：`plot.review`（decision=approve）；
- 网关校验：角色 keeper ✓，本村 ✓，状态可审核 ✓；
- 写入：地块 `status = active`；
- 审计事件：`plot.approved`（actor=王入库，**不带 agentId**）。

审计里能清楚看到：AI 提议过、人工拍了板。

### 事件 4 · 入库员创建批次

王入库为已生效地块创建批次：“高山云雾茶”。

- 调用：`batch.create`；
- 校验：地块属于本村且已生效；
- 写入：批次 `status = available`；
- 审计事件：`batch.created`。

### 事件 5 · 消费者溯源并预约

张顾客在商城看到“高山云雾茶”，查看溯源。

- 调用：`trace.query`；
- 返回公开视图：产品、村组、面积、作物、批次状态；
- **不返回** `ownerUid`、手机号等敏感字段。

张顾客下单。

- 调用：`booking.create`；
- 写入：预约 `status = booked`，`assignedTo` 为空；
- 审计事件：`booking.created`。

### 事件 6 · 调度 Agent 建议履约人

dispatcher 读取预约和批次。

- 调用：`dispatch.suggest`；
- 查到本村入库员王入库，输出建议：`assigneeUid = keeper-001`，置信度 0.86；
- 审计事件：`dispatch.suggested`，带 `agentId = dispatcher`；
- **关键**：预约的 `assignedTo` 仍为空，Agent 没有派单权。

如果本村没有可用入库员，建议返回空，置信度 0，并提示升级人工。

### 事件 7 · 王入库确认派单

- 调用：`dispatch.assign`；
- 校验：被分配人必须是本村入库员；
- 写入：预约 `assignedTo = keeper-001`；
- 审计事件：`dispatch.assigned`（actor=王入库，不带 agentId）。

### 事件 8 · 预警哨兵主动扫描

孙管理员（或定时任务）触发 alert-sentinel。

- 调用：`alert.scan`；
- 扫描三类异常：
  - 地块已提交但未审核 → `stale_plot`（warn）；
  - 批次已上架但无预约 → `unsold_batch`（critical）；
  - 预约已创建但未派单 → `unassigned_booking`（critical）；
- 每个告警按 `dedupeKey` 去重，重复扫描不会重复生成；
- 审计事件：`alert.scanned`，带 `agentId = alert-sentinel`。

### 事件 9 · 审计员处置告警

赵审计查看告警，确认其中一条。

- 调用：`alert.list` → 看到所有未关闭告警；
- 调用：`alert.ack` → 告警 `status = acknowledged`；
- 审计事件：`alert.acknowledged`。

### 事件 10 · 管理员看全局

孙管理员查看系统状态。

- 调用：`system.status`；
- 返回：地块数、批次数、预约数、告警数、审计事件数；
- 用于判断闭环是否健康。

## 三、异常分支

| 场景 | 发生什么 | 事件 |
| --- | --- | --- |
| 农户尝试审核 | 角色不在允许列表，拒绝 | `access.denied`（reason=role） |
| 外村入库员审核/建批次 | 村范围不符，拒绝 | `access.denied`（reason=village） |
| 消费者尝试建批次 | 角色不允许，拒绝 | `access.denied` |
| 入库员查审计 | 角色不允许，拒绝 | `access.denied` |
| 地块未生效就建批次 | 拒绝，提示地块未生效 | 无写入 |
| 预约没有本村入库员 | 调度建议为空，人工无法强派 | `dispatch.suggested`（assignee=null） |
| 告警重复扫描 | 按 dedupeKey 不再生成 | `alert.scanned`（created=0） |
| AI 建议后无人确认 | 状态不变，不会自动生效 | 仅 `review.suggested` / `dispatch.suggested` |

## 四、闭环完成的判定

- [x] 五个角色各至少完成一次业务动作；
- [x] AI 在审核、预警、调度三处主动介入；
- [x] 审核与派单由人拍板，AI 只提议；
- [x] 预警由 Agent 主动生成，可去重、可确认；
- [x] 越权与跨村访问被拒并留痕；
- [x] 溯源不暴露敏感字段；
- [x] 审计能区分 AI 提议（带 agentId）与人工操作。

## 五、与实现/测试的对应

| 时间线 | 实现 | 测试 |
| --- | --- | --- |
| 事件 1/3/4/5 | `role-gateway.ts` | `five-role.test.ts` |
| 事件 2 | `active-agents.ts` review-agent | `active-agents.test.ts` |
| 事件 6 | `active-agents.ts` dispatcher | `active-agents.test.ts` |
| 事件 8/9 | `role-gateway.ts` alert.scan/ack | `active-agents.test.ts` |
| 事件 10 | `system.status` | `five-role.test.ts` |

当前结果：2 个测试文件、11 个用例通过，TypeScript strict 通过。

## 六、仍然缺什么

- 没有真实 UI：事件由测试和 demo 触发；
- 没有定时器/消息队列：预警扫描是手动触发；
- 没有真实数据库：状态在内存；
- 没有真实 LLM：三类 Agent 是规则模拟；
- 没有部署：未上 CloudBase。

所以这份文本证明的是**闭环与职责边界成立**，不是生产可用。
