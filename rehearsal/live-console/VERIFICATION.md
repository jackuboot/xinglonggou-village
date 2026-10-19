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

云端提交 600 公斤“高山云雾茶” → AI 审核：
  source=deepseek model=deepseek-chat
  recommendation=reject confidence=0.7
  reasons:
    申报数量为600公斤，超过500公斤的核对阈值，需要进一步核实
    申报品种为高山云雾茶，属于茶叶，不属于蔬菜类入库范围
    采收日期2026-10-18早于今天2026-10-19，日期本身无异常
    申报信息缺少检测结果等关键质量信息
  ledger: review.suggested / agentId=deepseek-review-agent
  queue: 10 done / 0 pending / 0 failed

云端 UI 再次点击“AI 审核建议”：
  徽标显示“DeepSeek 已配置 · deepseek-chat”
  toast 显示“建议 reject · 置信度 0.8 · DeepSeek：...”
  queue 11 done / 0 pending / 0 failed

本地 UI 徽标同样显示“DeepSeek 已配置 · deepseek-chat”
```

真实模型输出不保证正确：本地一次调用把 `2026-10-18` 误判为“未来日期”。这正是 AI 只做建议、必须人工确认的原因。

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
