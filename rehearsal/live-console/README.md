# 货物流转控制台（live-console）

> 目的：以“一件货物”为主线，把「农户提交 → AI 审核 → 自动入库/上架 → 消费者下单 → AI 派单 → 审计留痕」做成一条可看懂、可操作的货物流转演示。人类只在审核节点拍板，其余业务数据由系统沿路生成。

## 在线地址

| 内容 | 地址 |
| --- | --- |
| 控制台 UI（CloudBase 静态托管） | https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/live/ |
| API（HTTP 访问服务） | https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.ap-shanghai.app.tcloudbase.com/api |
| CloudBase 环境 | `bigfish-2026-d4gixfnab6e09d0f2` |
| 云函数 | `live-console-api` |

首次打开测试域名会出现 CloudBase 的“页面访问提示”，点“确定访问”即可。

## 本地运行

```bash
cd rehearsal/live-console
npm install
cp .env.example .env    # 可选：填入 DEEPSEEK_API_KEY；不填则规则兜底
npm run dev             # http://127.0.0.1:4310
npm run typecheck
npm run smoke:local     # 需要服务已启动
npm run test:ai         # 4 个 AI 审核场景矩阵（需要服务已启动 + 密钥）
npm run check:deepseek  # 有密钥时验证 DeepSeek 连通性
npm run seed:demo       # 生成一组货物流转演示数据（默认云端）
```

本地模式：JSON 文件持久化（`data/state.json`）+ 进程内 SSE 推送。重启服务后数据仍在。

## 云端运行

```bash
cd rehearsal/live-console
tcb fn deploy live-console-api --force --yes
tcb service create -p api -f live-console-api
npm run build:hosting
MSYS_NO_PATHCONV=1 tcb hosting deploy hosting /live
npm run smoke:cloud
LC_API="https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.ap-shanghai.app.tcloudbase.com/api" npm run test:ai
```

- Git Bash 下部署静态托管必须加 `MSYS_NO_PATHCONV=1`，否则 `/live` 会被改写成 `C:/Program Files/Git/live`；
- `npm run build:hosting` 会把 `public/` 复制到 `hosting/`，并写入 `window.LC_API_BASE`；云端 UI 每 1.5 秒轮询，本地 UI 走 SSE；
- 云函数超时需 ≥60 秒（`cloudbaserc.json` 已配置），因为状态接口会访问 PostgreSQL 并消费事件队列。

## 货物流转 UI

页面以“一件货物”为主线，不再按角色平铺卡片。

- **顶部**：货物阶段统计（全部 / 待审核 / 待质检 / 待上架 / 待下单 / 已下单 / 已派单 / 已驳回）；
- **左侧**：货物清单，每件显示货物码、当前阶段和下一步动作；
- **右侧**：选中货物的完整旅程，六段为「提交 → AI审核 → 入库 → 上架 → 下单 → 履约/审计」；
- **每一步展示沿路生成的数据**：货物档案、AI 审核建议、入库单、上架批次、溯源码、订单、审计留痕；
- **人类只在审核站/质检站拍板**：通过后系统自动生成入库单和上架批次；消费者下单后系统自动生成订单并触发 AI 派单；
- 页面顶部的“下一步”直接说明这件货物当前该做什么。

| 数据 | 生成方式 |
| --- | --- |
| 货物档案 / 货物码 | 提交时生成；审核时由 AI 给出建议、置信度和风险理由 |
| 入库单 | 审核通过后系统自动生成（单号/仓库/重量/时间/操作人/质检提示） |
| 上架批次 / 溯源码 / 建议售价 | 审核通过后系统自动生成 |
| 订单 | 消费者下单时生成（订单号/买家/数量/金额/时间） |
| 派单 | AI 建议履约人并自动确认，写入预约 |
| 审计 | 每个动作实时留痕，按货物聚合到旅程最后一段 |

说明：AI 负责审核判断；入库、上架、订单编号等是系统按真实事件和规则生成的结构化单据，界面会分别标注“AI 审核 / 系统自动 / 人工确认 / 消费者”。

### 货物自治层（模拟）

在货物流转之上加了一层“货物自己判断下一站”的模拟：

- **世界地图**：提交港、审核站、质检/维修站、入库站、上架站、交易港、履约站、审计灯塔；每站显示位置和能力；
- **自检改道**：货物携带数量、日期、品类和 AI 审核结果；发现超量、未来日期、品类不符或 AI 建议驳回时，自动改道质检/维修站；正常货物走审核站；
- **人工闸门**：审核站和质检/维修站需要人拍板；入库、上架、交易、履约、审计由站点自动处理；
- **货船状态**：详情顶部显示当前位置、目的地、状态、已携带单据和自检异常；
- **自治日志**：按真实审计事件解释“我为什么去下一站”。

当前是 **UI 层的模拟决策器**（基于真实业务状态和审计事件），不是独立的分布式货物 Agent。下一步应把 `anomalyFlags / cargoPosition` 这套策略搬到后端长驻运行时，站点以能力契约注册，货物通过事件队列请求服务、接收受理/拒绝并重新规划路线。

种子示例（`npm run seed:demo`）：土豆 200kg 已派单；大白菜 150kg 待审核；高山云雾茶 5kg 待质检（自检异常，改道质检站等待人工拍板）。实际页面会随审核、下单等操作变化。

### 预警可读性

- 标题用业务对象，例如“大白菜 · 批次 PC-CB4A26 上架后仍无订单”，不显示 `unsold_batch`、`batch-xxx`；
- 类型显示中文：批次滞销 / 待审超时 / 订单未派单；
- 严重度显示“高优先级 / 需关注”，不再显示 `critical / warn`；
- 每条预警给一句处理建议，并提供“查看这件货物”和“确认并关闭”；
- 条件已经解除的旧预警不再出现在待处置列表（例如批次已有订单后，旧的滞销预警不再展示）。

### 预警与审计规则

预警不再在扫描函数里写死，改成“规则包 + 通用评估器”：

- **规则包** `2026-10-19.1`：待审超时（2h/8h）、批次上架无订单（24h/72h）、订单未派单（1h/4h）；
- **观察期**：未达到 `warnAfterMinutes` 不产生告警，所以当天刚上架不会判滞销；
- **升级**：达到 `criticalAfterMinutes` 自动从“需关注”升级为“高优先级”，已确认的告警会重新打开；
- **自动解除**：条件消失（如批次有了订单）自动 `resolved`，并写审计；
- **可回放**：扫描时间可选当前 / 1 小时后 / 24 小时后 / 72 小时后，用 `asOf` 评估，不修改系统时间；
- **可解释**：告警显示规则、已持续时长、观察期、责任角色、建议动作；规则面板可展开查看全部阈值；
- **可审计**：`alert.scanned / raised / escalated / resolved / acknowledged` 全部留痕，带规则版本与 `asOf`。

详细设计见 [预警与审计规则设计](../../docs/knowledge/架构与技术选型/预警与审计规则设计.md)。阈值是预演默认值，正式版应接村规/政策配置。

## 云端数据与队列

| 对象 | 实现 |
| --- | --- |
| 业务数据 | CloudBase 环境自带 PostgreSQL，表 `public.lc_entities`，按 `(kind,id)` + `jsonb` 存蔬菜、批次、预约、告警、审计、入库员 |
| 事件队列 | 表 `public.lc_events`，状态 `pending → processing → done/failed`，带 `attempts`、`last_error`、失败重试 |
| 队列语义 | 至少一次投递；审计主键由事件 ID 派生（`audit-<eventId>`），重复消费不会产生重复审计 |
| 消费者 | 动作完成后内联消费；管理员可点“消费事件队列”调用 `worker.drain`；失败事件保留重试 |
| 重置 | 清空业务数据与队列，保留入库员种子数据 |

这不是 CKafka/TDMQ，而是预演阶段用 PG 事务表实现的 outbox/queue。接口语义与 broker 对齐，后续可替换为真实消息队列。

## DeepSeek

- 通过 OpenAI 兼容接口 `/chat/completions` 调用，模型默认 `deepseek-chat`；
- 未配置密钥、超时、HTTP 错误或输出不合法时**明确回退规则**，界面显示“DeepSeek 未配置 · 规则兜底”，不伪装成模型结果；
- AI 审核只写 `review.suggested` 审计并给建议，不改变蔬菜状态；人工点“通过/驳回”后才生效；
- 配置本地密钥：编辑 `rehearsal/live-console/.env`，然后 `npm run check:deepseek` 验证密钥与网络；
- 配置云端密钥：CloudBase 控制台 → 云函数 `live-console-api` → 配置 → 环境变量，新增 `DEEPSEEK_API_KEY`（可选 `DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`）。配置后重新点“AI 审核建议”，徽标应变为“DeepSeek 已配置”，返回的 `source` 应为 `deepseek`。

当前环境已配置密钥并验证：本地与云端都返回 `source=deepseek`，云端模型为 `deepseek-chat`。真实模型输出不保证正确（例如曾把 `2026-10-18` 误判为未来日期），因此仍只作为建议、必须人工确认。

### AI 场景矩阵

`npm run test:ai` 会提交四个场景并调用真实模型：

| 场景 | 输入 | 期望 |
| --- | --- | --- |
| 正常蔬菜 | 大白菜 120 公斤，今天采收 | approve |
| 超量申报 | 时令蔬菜 600 公斤，今天采收 | reject |
| 品类不符 | 高山云雾茶 5 公斤，今天采收 | reject |
| 未来采收日期 | 大白菜 50 公斤，2099-12-31 | reject |

提示词已把日期规则和三条拒绝阈值写死；本地与云端均 4/4 命中，审计都带 `agentId=deepseek-review-agent`。

AI 返回结构不只是结论：

```json
{
  "recommendation": "approve | reject",
  "confidence": 0.95,
  "summary": "一句话结论",
  "approveReasons": ["支持通过的理由"],
  "rejectReasons": ["支持驳回的理由或风险"]
}
```

入库员分区会常驻显示“建议通过/建议驳回”、置信度、一句话结论和**建议理由**；反方理由默认折叠为“反方参考”，只有人认为建议不靠谱时再展开。事件流显示建议结论、置信度和理由条数，完整理由保存在 `review.suggested` 审计里。AI 只给建议，最终由入库员点通过或驳回。

为什么要保留反方理由：模型仍会同时评估两侧，审计需要留痕；但界面只主推置信度更高的结论，不把“通过/驳回”摆成两个人人都要权衡的选项。

## 当前边界

- 没有登录，五个角色是固定演示身份；生产需接 CloudBase 登录与 `user_roles`；
- 云端 UI 用轮询而不是 SSE（HTTP 访问服务不适合长连接）；
- 个人版环境不支持 CloudBase Run 容器部署；本方案使用“云函数 + HTTP 访问服务 + 静态托管”；
- 消息队列是 PostgreSQL 实现，不是独立 broker；
- 预警规则仍是确定性规则，未接入模型推理。

## 验证记录

见 [VERIFICATION.md](VERIFICATION.md)。
