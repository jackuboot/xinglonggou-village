# 06 · 部署与监测

## 目标形态

| 项 | 方案 |
| --- | --- |
| 运行形态 | CloudBase 云函数（范围 A） |
| 函数名 | `plot-submit` |
| 路由 | `event.action`：`plot.submit` / `plot.review` |
| 身份 | `cloudbase.getCloudbaseContext(context)` → `TCB_UUID` |
| 存储 | CloudBase PostgreSQL `plots` 表 + 审计表 |
| 返回 | `{ ok, data }` / `{ ok:false, code, message, retryable }` |

> 本地预演使用内存适配器，不声称已部署到 CloudBase。

## 正式部署步骤（实现阶段）

1. 将 `src/` 编译为 Node.js 可执行包（esbuild/tsc，待定）；
2. 在函数内注入 PostgreSQL 仓储与审计适配器；
3. 配置云函数环境变量（环境 ID、数据库连接由平台注入）；
4. 部署函数并配置超时/内存；
5. 用 `callFunction` 测试 `plot.submit` 与 `plot.review`；
6. 运行回归用例与审计断言。

## 监测点

| 事件 | 触发 | 字段 |
| --- | --- | --- |
| `plot.submitted` | 提交成功 | plotId, areaMu, crop, actorUid, traceId |
| `plot.approved` | 审核通过 | plotId, decision, actorUid, traceId |
| `plot.rejected` | 审核驳回 | plotId, decision, reason, traceId |
| `plot.conflict` | 版本冲突（建议新增） | plotId, expectedVersion, currentVersion |
| `plot.forbidden` | 越权（建议新增） | actorUid, action, traceId |

## 指标与告警

| 指标 | 目标 | 告警 |
| --- | --- | --- |
| 提交成功率 | ≥99% | <95% 告警 |
| API P95 | ≤500ms | >800ms 告警 |
| 审计写入覆盖率 | 100% | <100% 立即告警 |
| 版本冲突率 | <5% | >10% 排查并发 |
| 越权请求数 | 0 | >0 审计复核 |

## 安全

- 身份只信上下文，客户端 `actorUid` 不参与鉴权；
- keeper 仅本村；auditor 只读；
- 日志不写手机号、身份证、完整地址；
- 审计事件只增不改。

## 回滚

- 云函数保留上一版本，异常时回滚；
- 数据库采用只增字段迁移，回滚不删列；
- 版本冲突不覆盖数据，返回可重试错误。
