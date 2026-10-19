# 五角色实时控制台（live-console）

> 目的：把「农户提交蔬菜 → 入库员审核/建批次 → 消费者溯源/购买 → 调度 → 预警 → 审计」做成**同屏可见、可交替操作、数据可回读**的演示，验证 UI、角色边界、主动 Agent、事件队列与 CloudBase 部署。

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
npm run check:deepseek  # 有密钥时验证 DeepSeek 连通性
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
```

- Git Bash 下部署静态托管必须加 `MSYS_NO_PATHCONV=1`，否则 `/live` 会被改写成 `C:/Program Files/Git/live`；
- `npm run build:hosting` 会把 `public/` 复制到 `hosting/`，并写入 `window.LC_API_BASE`；云端 UI 每 1.5 秒轮询，本地 UI 走 SSE；
- 云函数超时需 ≥60 秒（`cloudbaserc.json` 已配置），因为状态接口会访问 PostgreSQL 并消费事件队列。

## 五个分区

| 分区 | 能做什么 |
| --- | --- |
| 农户 | 提交蔬菜批次（村组/蔬菜/公斤/采收日期） |
| 入库员 | AI 审核建议、通过/驳回、创建可售批次、AI 派单建议、确认派单 |
| 消费者 | 查看可购买批次、溯源、购买 |
| 审计员 | 查看并确认告警 |
| 管理员 | 主动扫描预警、查看统计、审计事件、存储与队列状态、手动消费队列 |
| 底部事件流 | 本地 SSE / 云端轮询，显示业务动作、AI 建议、越权拒绝 |

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

## 当前边界

- 没有登录，五个角色是固定演示身份；生产需接 CloudBase 登录与 `user_roles`；
- 云端 UI 用轮询而不是 SSE（HTTP 访问服务不适合长连接）；
- 个人版环境不支持 CloudBase Run 容器部署；本方案使用“云函数 + HTTP 访问服务 + 静态托管”；
- 消息队列是 PostgreSQL 实现，不是独立 broker；
- 预警规则仍是确定性规则，未接入模型推理。

## 验证记录

见 [VERIFICATION.md](VERIFICATION.md)。
