# 五角色业务闭环 · 事件预演文本（蔬菜批次）

> 用途：用一条完整时间线说明五角色和 AI 在“农户提交蔬菜 → 消费者买到”闭环里**各自做什么、发什么事件、谁拍板、失败怎么走**。
> 对应实现：`rehearsal/five-role-loop/`。本文是叙事文本，不是接口文档。

## 一、出场角色

| 角色/Agent | 身份 | 在闭环中的职责 |
| --- | --- | --- |
| 李桂芳 | 农户 farmer | 提交蔬菜批次、查看自己的蔬菜 |
| 王入库 | 入库员 keeper | 审核蔬菜、创建可售批次、确认派单 |
| 张顾客 | 消费者 consumer | 查溯源、创建购买 |
| 赵审计 | 审计员 auditor | 查审计事件、确认告警 |
| 孙管理员 | 管理员 admin | 看全局状态、触发预警扫描 |
| review-agent | 审核 Agent | 读蔬菜批次，给通过/驳回建议（不写状态） |
| alert-sentinel | 预警哨兵 | 扫描异常，生成告警（低风险写） |
| dispatcher | 调度 Agent | 建议履约人（不写派单） |
| 各角色助手 | 角色 Agent | 只调用本角色工具做查询和解释 |

## 二、时间线（正常闭环）

### 事件 1 · 农户提交蔬菜批次

李桂芳提交：“3 组，时令蔬菜，120 公斤，今天采收”。

- 调用：`produce.submit`；
- 网关校验：角色 farmer ✓，数据范围本人 ✓，数量与采收日期合法 ✓；
- 写入：蔬菜批次 `status = submitted`，记录 `submittedAt` 和 `harvestDate`；
- 审计事件：`produce.submitted`；
- 此时消费者看不到它，只是待审数据。

### 事件 2 · 审核 Agent 先给建议

系统为待审蔬菜调用 review-agent。

- Agent 读取批次：`review.suggest`；
- 输出：`recommendation = approve`，`confidence = 0.9`，理由“字段完整、数量在常见范围”；
- 审计事件：`review.suggested`，带 `agentId = review-agent`；
- **关键**：批次仍是 `submitted`，Agent 没有写权限。

如果申报 800 公斤，Agent 会建议 `reject`，理由“申报数量超过 500 公斤，请核对采收记录”，置信度 0.82。

### 事件 3 · 入库员拍板审核

王入库看到建议，决定通过。

- 调用：`produce.review`（approve）；
- 校验：角色 keeper ✓，本村 ✓，状态可审核 ✓；
- 写入：批次 `status = active`；
- 审计事件：`produce.approved`（人工操作，不带 agentId）。

### 事件 4 · 入库员创建可售批次

王入库创建批次：“时令蔬菜”。

- 调用：`batch.create`；
- 校验：蔬菜属于本村且已生效；
- 写入：批次 `status = available`；
- 审计事件：`batch.created`。

### 事件 5 · 消费者溯源并购买

张顾客看到“时令蔬菜”，查看溯源。

- 调用：`trace.query`；
- 返回公开视图：产品、村组、蔬菜名、数量、采收日期、批次状态；
- **不返回** `farmerUid`、手机号等敏感字段。

张顾客下单。

- 调用：`booking.create`；
- 写入：购买记录 `status = booked`，`assignedTo` 为空；
- 审计事件：`booking.created`。

### 事件 6 · 调度 Agent 建议履约人

dispatcher 读取购买记录和批次。

- 调用：`dispatch.suggest`；
- 查到本村入库员王入库，输出建议：`assigneeUid = keeper-001`，置信度 0.86；
- 审计事件：`dispatch.suggested`，带 `agentId = dispatcher`；
- **关键**：购买记录仍未派单。

如果本村没有可用入库员，建议返回空，提示升级人工。

### 事件 7 · 王入库确认派单

- 调用：`dispatch.assign`；
- 校验：被分配人必须是本村入库员；
- 写入：购买记录 `assignedTo = keeper-001`；
- 审计事件：`dispatch.assigned`（人工操作，不带 agentId）。

### 事件 8 · 预警哨兵主动扫描

孙管理员（或定时任务）触发 alert-sentinel。

- 调用：`alert.scan`；
- 扫描三类异常：
  - 蔬菜已提交但未审核 → `stale_produce`（warn）；
  - 批次已上架但无购买 → `unsold_batch`（critical）；
  - 购买已创建但未派单 → `unassigned_booking`（critical）；
- 每个告警按 `dedupeKey` 去重；
- 审计事件：`alert.scanned`，带 `agentId = alert-sentinel`。

### 事件 9 · 审计员处置告警

赵审计查看并确认告警。

- `alert.list` → 看到未关闭告警；
- `alert.ack` → 告警 `status = acknowledged`；
- 审计事件：`alert.acknowledged`。

### 事件 10 · 管理员看全局

孙管理员查看系统状态。

- `system.status` → 蔬菜批次数、批次数、购买数、告警数、审计事件数；
- 判断闭环是否健康。

## 三、异常分支

| 场景 | 发生什么 | 事件 |
| --- | --- | --- |
| 农户尝试审核 | 角色不允许，拒绝 | `access.denied`（reason=role） |
| 外村入库员审核/建批次 | 村范围不符，拒绝 | `access.denied`（reason=village） |
| 消费者尝试建批次 | 角色不允许，拒绝 | `access.denied` |
| 入库员查审计 | 角色不允许，拒绝 | `access.denied` |
| 蔬菜未生效就建批次 | 拒绝，提示未生效 | 无写入 |
| 购买没有本村入库员 | 调度建议为空，人工无法强派 | `dispatch.suggested`（assignee=null） |
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

这份文本证明的是**闭环与职责边界成立**，不是生产可用。
