# 预演目录索引

| 内容 | 说明 |
| --- | --- |
| [minimal-validation.md](minimal-validation.md) | 最小业务 + 架构设计验证（设计态主文档） |
| [event-walkthrough.md](event-walkthrough.md) | 五角色+主动 Agent 的完整事件预演文本（推荐先读） |
| [agri-qa/](agri-qa/README.md) | AI 主链路最小实现：农事问答、RAG、工具网关、人工升级、检查点恢复 |
| [five-role-loop/](five-role-loop/README.md) | 五角色最小闭环：RBAC/ABAC、跨角色交接、审计，含审核建议/预警扫描/调度建议三类主动 Agent |
| [live-console/](live-console/README.md) | 五角色同屏实时控制台：CloudBase 函数 + PostgreSQL + 事件队列 + 静态 UI，含 DeepSeek 审核入口 |
| [plot-submit/](plot-submit/README.md) | 地块提交业务切片（设计文档 + 代码附录） |

## 建议阅读顺序

1. `event-walkthrough.md`：先看五角色与 AI 如何按时间线完成闭环；
2. `minimal-validation.md`：再看架构如何被一条业务验证；
3. `five-role-loop/VERIFICATION.md`：看五角色与权限边界；
4. `agri-qa/VERIFICATION.md`：看 AI 主链路与恢复；
5. `live-console/VERIFICATION.md`：看 UI、PostgreSQL、事件队列与 CloudBase 部署验证；
6. `plot-submit/08-vs-blueprint.md`：看与蓝图 MVP 的差距。

## 结论边界

这些是设计阶段的最小验证，不是生产系统。`live-console` 已把 UI、PostgreSQL、真实 DeepSeek 与 CloudBase 部署跑通；独立消息队列、登录身份和公开接口防护仍是未验证项，详见其 `VERIFICATION.md`。
