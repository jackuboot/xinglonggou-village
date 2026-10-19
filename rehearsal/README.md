# 预演目录索引

| 内容 | 说明 |
| --- | --- |
| [minimal-validation.md](minimal-validation.md) | 最小业务 + 架构设计验证（设计态主文档） |
| [agri-qa/](agri-qa/README.md) | AI 主链路最小实现：农事问答、RAG、工具网关、人工升级、检查点恢复 |
| [five-role-loop/](five-role-loop/README.md) | 五角色最小闭环：RBAC/ABAC、跨角色交接、审计，含审核建议/预警扫描/调度建议三类主动 Agent |
| [plot-submit/](plot-submit/README.md) | 地块提交业务切片（设计文档 + 代码附录） |

## 建议阅读顺序

1. `minimal-validation.md`：先看架构如何被一条业务验证；
2. `five-role-loop/VERIFICATION.md`：看五角色与权限边界；
3. `agri-qa/VERIFICATION.md`：看 AI 主链路与恢复；
4. `plot-submit/08-vs-blueprint.md`：看与蓝图 MVP 的差距。

## 结论边界

这些是设计阶段的最小验证，不是生产系统；真实 ASR/模型/数据库/部署仍未验证。
