# live-console 验证记录

- 验证日期：2026-10-19
- 环境：CloudBase `bigfish-2026-d4gixfnab6e09d0f2`（个人版）
- 云函数：`live-console-api`（Nodejs18.15，超时 60s，内存 256MB）
- HTTP 访问服务：`/api`
- 静态托管：`/live/`

## 已验证

### 1. 本地持久化

```text
提交 3组 / 高山云雾茶 / 5 公斤
→ data/state.json 生成
→ 停止服务并重启
→ GET /api/state 仍返回 3组 / 高山云雾茶，审计 1 条
```

首次用 Git Bash `curl -d` 传中文时出现 U+FFFD，是 Windows 参数编码问题；改用 UTF-8 Node 脚本后正常。

### 2. CloudBase 全链路（`npm run smoke:cloud`）

```text
reset: true
submit: produce-<id> 高山云雾茶 submitted
after submit: produceStatus=submitted
  audit=[produce.submitted]
  queue={pending:0, processing:0, done:1, failed:0}
review-ai: source=fallback recommendation=approve confidence=0.9
  reasons=[字段完整、数量在常见范围, DeepSeek 未配置，使用规则兜底]
review: active
batch: batch-<id> available
trace fields: batchId,productName,groupName,vegetableName,quantityKg,harvestDate,batchStatus
trace has farmerUid: false
booking: booking-<id> booked
dispatch-ai: assigneeUid=keeper-001 confidence=0.86 requiresHumanDecision=true
assigned: keeper-001
scan: created=0 open=0（此时所有告警条件均已解除）
final stats: produces=1 batches=1 bookings=1 alerts=0 audit=8
queue: pending=0 processing=0 done=8 failed=0
storage: postgres / lc_entities / lc_events
```

每次运行生成的 ID 不同；以上为最近一次重跑（2026-10-19 14:14）的结果。

### 3. 浏览器 UI（CloudBase）

已验证的操作序列：

```text
重置演示数据 → 提交“高山云雾茶”120 公斤
→ AI 审核建议（显示规则兜底与理由）
→ 通过 → 创建可售批次
→ 消费端溯源（公开视图不含 farmerUid）
→ 购买
→ 扫描预警（生成 unassigned_booking critical 告警）
→ 审计员确认告警
→ AI 派单建议（keeper-001）
→ 人工确认派单
→ 队列 9 done / 0 pending / 0 failed
```

截图：`screenshots/cloud-ui.png`、`screenshots/local-ui.png`（本地产物，未提交）。

### 4. 数据回读

- 云函数 `state` 直接从 PostgreSQL `lc_entities` 读取，刷新页面/换浏览器后数据仍在；
- `lc_events` 保留 8~9 条事件，状态均为 `done`；
- 审计事件由队列消费者幂等写入，重复消费不会重复。

### 5. 真实 DeepSeek（本地 + 云端）

配置密钥后已验证：

```text
本地 npm run check:deepseek → HTTP 200
本地 /api/state → ai.deepseekConfigured=true
云端 /api/state → ai.deepseekConfigured=true

云端提交 600 公斤“时令蔬菜” → AI 审核：
  source=deepseek model=deepseek-chat
  recommendation=reject confidence=0.95
  summary=申报数量600公斤超过500公斤上限，需人工核对后再入库
  approveReasons:
    采收日期2026-10-19等于今天，不属于未来日期
    申报品类为时令蔬菜，属于蔬菜范围
  rejectReasons:
    申报数量600公斤超过500公斤，按规则需驳回并人工核对
    申报信息未提供具体蔬菜品种、产地或检测信息，存在信息缺失风险
  ledger: review.suggested / agentId=deepseek-review-agent
  queue: 10 done / 0 pending / 0 failed

云端 UI 点击“AI 审核建议”：
  徽标显示“DeepSeek 已配置 · deepseek-chat”
  入库员分区出现常驻建议面板（不再只靠 toast）
  面板显示：建议驳回 / 置信度 / 一句话结论 / 支持通过 / 支持驳回
  事件流显示：建议 reject · 通过理由 2 条 · 驳回理由 2 条

本地 UI 徽标同样显示“DeepSeek 已配置 · deepseek-chat”
```

真实模型输出不保证正确：本地一次调用把 `2026-10-18` 误判为“未来日期”。这正是 AI 只做建议、必须人工确认的原因。

### 6. AI 场景矩阵（本地 + 云端）

`npm run test:ai` 提交四个场景并调用真实 DeepSeek：

| 场景 | 输入 | 期望 |
| --- | --- | --- |
| 正常蔬菜 | 大白菜 120 公斤，今天采收 | approve |
| 超量申报 | 时令蔬菜 600 公斤，今天采收 | reject |
| 品类不符 | 高山云雾茶 5 公斤，今天采收 | reject |
| 未来采收日期 | 大白菜 50 公斤，2099-12-31 | reject |

第一次结果：4 个场景全部 `source=deepseek`，但只有“未来日期”命中；模型把“今天”误判成未来日期，并且对超量、品类不符给了 approve。说明“能调用模型”不等于“流程判定正确”。

修正提示词：

- 明确“只与系统给出的今天比较，不得用训练数据推断日期”；
- 明确三条拒绝阈值：数量 >500、日期晚于今天、品类不是蔬菜；
- 保留“不得编造检测结果”。

修正后结果：

```text
本地：4/4 命中，全部 source=deepseek
云端：4/4 命中，耗时 3.1s / 1.8s / 1.6s / 1.3s
云端队列：8 done / 0 pending / 0 failed
云端 UI：4 条 AI测试组待审蔬菜；徽标“DeepSeek 已配置 · deepseek-chat”
审计：每条 review.suggested 都带 agentId=deepseek-review-agent
```

这验证的是“流程能跑 + AI 能按业务阈值给建议”，不是模型准确率验收；提示词仍需按真实村规继续迭代。

### 7. 双向理由（通过 / 驳回分别给原因）

AI 输出结构从单一 `reasons` 改为：

```json
{
  "recommendation": "approve | reject",
  "confidence": 0.95,
  "summary": "一句话结论",
  "approveReasons": ["支持通过的理由"],
  "rejectReasons": ["支持驳回的理由或风险"]
}
```

已验证：

```text
正常大白菜 120 公斤：
  建议通过，置信度 0.95
  支持通过：品类符合、数量正常、日期正常（3 条）
  支持驳回：无

时令蔬菜 600 公斤：
  建议驳回，置信度 0.95
  支持通过：日期正常、品类属于蔬菜（2 条）
  支持驳回：数量超过 500 公斤、信息缺失（2 条）
```

提示词要求“无论结论是通过还是驳回，都必须分别给出两侧理由；某一侧没有理由时输出空数组”，同时要求“最终只推荐一个结论，不得模棱两可”。

UI 不把两侧摆成并列选项：

- 主推 AI 推荐的结论（建议通过 / 建议驳回）和置信度；
- 只展开“建议理由”；
- 反方理由默认折叠为“反方参考（N 条）”，人类认为建议不靠谱时再展开；
- 事件流显示建议结论、置信度、建议理由条数和反方参考条数；
- 完整两侧理由仍保存在审计事件里，便于追溯。

实测：

```text
正常大白菜 120 公斤：
  建议通过 · 置信度 0.95
  建议理由 3 条；反方参考：无

时令蔬菜 600 公斤：
  建议驳回 · 置信度 0.95
  建议理由 2 条（超量、信息缺失）
  反方参考折叠 2 条（日期正常、品类属于蔬菜）
```

### 8. 流程式 UI

页面从“五张角色卡片平铺”改为“业务闭环流程”：

- 顶部 7 个阶段节点：农户提交 → 入库审核 → 上架批次 → 溯源购买 → 履约派单 → 审计预警 → 全局视图；
- 每个节点显示待办数量，有待办的节点高亮；
- 只展开当前阶段的操作台，点击节点切换；
- “下一步”自动定位到最需要处理的阶段；
- 完成动作后自动推进。

已验证的推进路径：

```text
重置 → 农户提交（步骤 1）
提交蔬菜 → 自动进入入库审核（步骤 2）
AI 建议 + 通过 → 自动进入上架批次（步骤 3）
创建批次 → 自动进入溯源购买（步骤 4）
购买 → 自动进入履约派单（步骤 5）
确认派单 → 自动进入全局视图（步骤 7）
扫描预警 → 自动进入审计预警（步骤 6）
确认告警 → 若仍有待审蔬菜，自动回到入库审核
```

同时修复了一个流程断点：已建批次的蔬菜不再计入“待建”，后端 `batch.create` 对同一蔬菜幂等返回已有批次，避免重复建批次。

截图：`screenshots/flow-ui-local.png`、`screenshots/flow-ui-cloud.png`（本地产物，未提交）。

### 9. 货物流转 UI（以货物为主线）

页面从“角色/阶段切换”进一步改成“以一件货物为主线”：

- 左侧货物清单显示货物码、当前阶段和下一步动作；
- 右侧是选中货物的六段旅程：提交 → AI审核 → 入库 → 上架 → 下单 → 履约/审计；
- 每一步展示沿路生成的数据：货物档案、AI 审核建议、入库单、上架批次、溯源码、订单、审计留痕；
- 人类只在 AI 审核节点拍板；审核通过后系统自动生成入库单和上架批次；消费者下单后系统自动生成订单并触发 AI 派单。

本地实测（大白菜 120 公斤）：

```text
提交 → AI 自动生成审核建议（DeepSeek，建议通过，0.95）
人工点“通过，自动入库上架”
→ 入库单 RK-B777F2 / 兴隆沟村保鲜库 / 120 公斤
→ 批次 PC-DCFBD3 / 库位 A-10 / 建议售价 ¥3.6/公斤 / 溯源码 SY-DCFBD3
→ 下一步：消费者下单
点“模拟消费者下单”
→ 订单 DD-0A2F69 / 120 公斤 / ¥432.00
→ AI 自动派单给 keeper-001
→ 当前：已派单（等待履约与审计）
```

云端演示种子（`npm run seed:demo`）留下三件货物：

```text
土豆 200 公斤    已派单（审核通过 → 自动入库上架 → 下单 → 自动派单）
大白菜 150 公斤  待审核（AI 建议通过，等待人工拍板）
高山云雾茶 5 公斤 待质检（AI 建议驳回，货物自检异常，改道质检站）
```

云端状态：3 件货物、1 个批次、1 个订单、11 条审计、队列 11 done / 0 pending / 0 failed。

说明：AI 负责审核判断；入库单、上架批次、溯源码、订单号等是系统按真实事件和规则生成的结构化单据，界面分别标注“AI 审核 / 系统自动 / 人工确认 / 消费者”，没有把模板数据说成模型生成。

截图：`screenshots/goods-journey-local.png`、`screenshots/goods-journey-cloud.png`（本地产物，未提交）。

### 10. 货物自治层（模拟）

在货物流转之上加了“货物自己判断下一站”的模拟：

- **世界地图**：提交港、审核站、质检/维修站、入库站、上架站、交易港、履约站、审计灯塔；每站显示位置和能力；
- **自检改道**：货物携带数量、日期、品类和 AI 审核结果；发现超量、未来日期、品类不符或 AI 建议驳回时，自动改道质检/维修站；正常货物走审核站；
- **人工闸门**：审核站和质检/维修站需要人拍板；入库、上架、交易、履约、审计由站点自动处理；
- **货船状态**：详情顶部显示当前位置、目的地、状态、已携带单据和自检异常；
- **自治日志**：按真实审计事件解释“我为什么去下一站”。

本地实测（高山云雾茶 5 公斤）：

```text
自检发现：品类可能不是蔬菜；AI 建议驳回
→ 审核站标记“异常改道”
→ 质检/维修站“货物在此”，目的地=入库站
→ 日志：我申请改道最近的质检/维修站，等待人工拍板
```

运行 seed 后默认选中这件茶：阶段统计为“待审核 1 / 待质检 1 / 已派单 1”，世界地图上审核站改道、质检站高亮，下一步明确为“质检/维修站人工核验”。

边界：当前是 **UI 层的模拟决策器**，决策依据是真实业务状态和审计事件，不是独立的分布式货物 Agent。下一步应把 `anomalyFlags / cargoPosition` 这套策略搬到后端长驻运行时，站点以能力契约注册，货物通过事件队列请求服务、接收受理/拒绝并重新规划路线。

截图：`screenshots/autonomous-cargo-local.png`、`screenshots/autonomous-cargo-cloud.png`（本地产物，未提交）。

### 11. 预警可读性

原来的预警直接显示内部枚举和 ID：

```text
批次上架后暂无预约
unsold_batch · 目标 batch-cb4a260a · critical
确认告警
```

现在改为业务语言：

```text
大白菜 · 批次 PC-CB4A26 上架后仍无订单
高优先级
批次滞销 · 10/19 21:01
建议：入库员确认是否调整上架信息或下架，避免批次长期无订单。
[查看这件货物] [确认并关闭]
```

- 类型映射：`stale_produce → 待审超时`、`unsold_batch → 批次滞销`、`unassigned_booking → 订单未派单`；
- 严重度映射：`critical → 高优先级`、`warn → 需关注`；
- 通过 `targetId` 关联到货物/批次/订单，显示品种、数量、批次号、订单号；
- “查看这件货物”直接选中所属货物并滚动到旅程；
- 条件已解除的旧预警（例如批次已有订单）不再出现在待处置列表，避免“告警还挂着但货已卖出”。

已用云端真实数据验证：截图中的 `unsold_batch / batch-cb4a260a` 现在显示为“大白菜 · 批次 PC-CB4A26 上架后仍无订单”。

### 12. 预警规则引擎与时间窗

原来的三个 `if` 已替换为规则包 + 通用评估器：

| 规则 | 观察期（需关注） | 高优先级 | 责任角色 | 自动解除 |
| --- | --- | --- | --- | --- |
| `review.stale` 待审超时 | 2 小时 | 8 小时 | 入库员 | 不再待审 |
| `listing.no_booking` 上架无订单 | 24 小时 | 72 小时 | 入库员 | 出现订单 |
| `dispatch.unassigned` 订单未派单 | 1 小时 | 4 小时 | 入库员 | 已有履约人 |

已验证：

```text
当前时间扫描：旧的同日“滞销”告警被自动 resolved，created=0
模拟 24 小时后扫描：created=1
  type=unsold_batch ageMinutes=1478 thresholdMinutes=1440 severity=warn
规则版本：2026-10-19.1
单元测试：12 passed
  覆盖未到观察期不告警 / warn / critical 升级 / 去重 / 订单出现后自动解除
```

UI：

- 扫描时间可选当前 / 1 小时后 / 24 小时后 / 72 小时后；
- 告警显示“模拟评估 10/20 … · 已持续 1 天 · 观察期 1 天”；
- “预警规则 v2026-10-19.1 · 3 条”面板可展开，显示每条规则的阈值、责任角色和建议；
- 规则评估与告警生命周期写入审计：`alert.scanned / raised / escalated / resolved`。

设计文档：[预警与审计规则设计](../../docs/knowledge/架构与技术选型/预警与审计规则设计.md)。当前阈值是预演默认值；正式版需接业务日历、村规/政策配置、通知渠道和规则管理后台。

## 未验证

| 项 | 原因 | 下一步 |
| --- | --- | --- |
| 真实消息队列 | 个人版没有 CKafka/TDMQ 实例 | 现用 PG outbox/queue；需要 broker 时替换 `store.enqueue/drainQueue` |
| 登录与真实身份 | 演示使用固定五角色 UID | 接 CloudBase 登录与 `user_roles` |
| CloudBase Run 容器 | 个人版提示当前能力不支持该环境 | 保持“云函数 + HTTP 访问服务 + 静态托管” |
| 公开接口防护 | 当前无登录、无频率限制，`/api/reset` 可被公开调用 | 上线前加登录、限流、关闭/保护 reset |

## 复现命令

```bash
cd rehearsal/live-console
npm run typecheck
npm run smoke:local     # 本地服务已启动
npm run smoke:cloud     # 部署后
```

部署：

```bash
tcb fn deploy live-console-api --force --yes
tcb service create -p api -f live-console-api
npm run build:hosting
MSYS_NO_PATHCONV=1 tcb hosting deploy hosting /live
```
