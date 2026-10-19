# 地块提交纵向预演（plot-submit）

> 目的：用一条最小但完整的纵向切片，验证架构框架能否同时满足**业务目标、监测目标、部署目标、架构规范**。
> 性质：参考实现（reference slice），不进入生产；用于暴露流程与规范问题，再反哺正式实现。

## 场景

农户提交地块 → 入库员审核 → 地块生效；农户侧可由 AI 从语音转写中预填字段，但必须人工确认。

## 覆盖的架构点

- 需求 → schema → 测试 → 纯函数业务 → AI 工具暴露 → 验收；
- 云函数接口边界（`event.action` + 上下文身份）与外部 HTTP 隔离；
- 行级权限、幂等、并发版本、审计留痕；
- AI 工具只读、需确认、不直接写库；
- 监测事件与部署映射。

## 目录

| 文件 | 内容 |
| --- | --- |
| `01-requirements.md` | 需求卡与验收口径 |
| `02-data-model.md` | 数据模型、状态机、权限、事件 |
| `03-test-cases.md` | 测试先行用例与执行结果 |
| `04-implementation.md` | 分层实现与接口边界 |
| `05-ai-integration.md` | Agent 契约与 `plot.prefill` 工具 |
| `06-deployment-monitoring.md` | 云函数部署映射与监测点 |
| `07-acceptance.md` | 验收清单、证据、缺口 |
| `08-vs-blueprint.md` | 与蓝图 P0/MVP 的差距（结论：不是 MVP） |
| `agents/`、`tools/` | Agent 契约与工具 JSON Schema |

## 运行

```bash
cd rehearsal/plot-submit
npm install
npm test        # 17 个用例
npm run typecheck
```

## 当前结果

- 4 个测试文件、17 个用例全部通过；
- TypeScript strict 类型检查通过；
- 覆盖提交、幂等、审核、驳回、越权、跨村、版本冲突、AI 预填与契约校验。

## 非目标

- 不做真实 UI、不接真实短信登录；
- 不部署到 CloudBase（只给部署映射）；
- 不接真实 ASR/大模型（预填工具用纯函数模拟）；
- 不验证真实农户使用效果（属于实现/试运行阶段）。
