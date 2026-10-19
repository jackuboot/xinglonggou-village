# 08 · 与蓝图的差距（预演 vs MVP）

> 结论：`rehearsal/plot-submit` 是**架构合规的纵向切片**，不是蓝图的 P0 MVP。
> 它验证了"需求→schema→测试→业务→AI 工具契约→验收"的方法，但 AI Agent、模型、RAG、运行时、真实部署都还没有真正介入。

## 一、逐项对比

| 维度 | 蓝图 P0 / MVP 要求 | 本次预演 | 差距 |
| --- | --- | --- | --- |
| 业务闭环 | 农户提交、审核、入库、订单、服务 | 只做地块提交与审核 | 缺入库、订单、服务、文化资源 |
| AI 场景 | 方言语音问答、病虫害识别、入库质检、官网内容 | **无真实 AI 场景** | 四项 P0 均未实现 |
| Agent 运行时 | LangGraph 编排、长驻运行时、Actor 会话 | 无运行时；只有 `farmer-copilot.agent.yaml` 契约 | 未接 LangGraph、无 checkpointer/interrupt |
| 模型/语音 | 神农 4.0 API/MCP、腾讯云 ASR、多模态 | `plot.prefill` 是纯函数模拟 | 无真实模型调用、无方言识别 |
| 工具/MCP | 工具网关、MCP、能力白名单 | 只有 `plot.prefill` JSON Schema | 无 MCP server、无工具网关 |
| 知识/RAG | pgvector、混合检索、引用 | 无 | 无知识入库、无检索 |
| 数据存储 | CloudBase PostgreSQL、行级权限 | 内存适配器 | 未接 PostgreSQL、未验证行级 SQL |
| 监测/审计 | trace、任务监测点、成本、告警 | 审计事件在测试中断言 | 无 trace、无看板、无告警 |
| 部署 | 云函数 + 长驻运行面 | 只有部署映射文档 | 未部署、未验证冷启动/超时 |
| UI/E2E | 工作台页面 + Playwright | 无 UI | 无 Playwright E2E |
| 架构规范 | schema 先行、函数式、模块化、测试先行、接口范围 | **已满足** | — |
| 验收 | 业务/监测/部署/架构四类目标 | 设计阶段通过 | 仅是切片验收，不是产品验收 |

## 二、AI Agent 介入了吗？

**没有真正介入。** 当前只有三样“AI 相关物”：

1. `tools/plot-prefill.tool.json`：工具契约，定义了输入输出与只读属性；
2. `agents/farmer-copilot.agent.yaml`：Agent 契约，定义了允许/禁止的工具；
3. `src/application/prefill-plot.ts`：用正则模拟的预填逻辑，不是模型。

缺的是：LangGraph 图、模型网关、ASR、工具网关、checkpointer、interrupt 人工确认、MCP 连接、成本与 trace。这些都在蓝图里，但预演没有落地。

## 三、预演真正验证了什么

- 纵向切片方法可行：需求 → schema → 用例 → 纯函数 → 适配器 → 验收；
- 业务规则可测：幂等、版本冲突、行级权限、驳回原因；
- 接口范围正确：云函数内部不用 REST，AI 工具只读且需确认；
- 监测有落点：审计事件结构与断言；
- 工程规范可执行：严格 schema、单文件小、Result 错误、类型检查通过。

## 四、达到蓝图 P0 MVP 还缺什么

1. **选一个真实 AI 场景做第二条切片**：方言语音问答或病虫害识别；
2. **接 LangGraph.js 运行时**：State、checkpointer、interrupt、工具网关；
3. **接真实模型/ASR**：神农 API/MCP 或腾讯云 ASR；
4. **接 PostgreSQL**：plots 表、审计表、行级权限；
5. **接知识库/RAG**：OCR 入库、pgvector、引用；
6. **接监测**：trace、任务事件、成本、告警；
7. **补 UI 与 Playwright**：提交/审核/确认页面；
8. **部署到 CloudBase**：云函数 + 长驻运行面。

## 五、建议的下一刀

优先做**方言语音农技问答**作为第二条纵向切片：

- 它同时覆盖 ASR、RAG、LangGraph 运行时、interrupt、引用与监测；
- 成功后，蓝图 P0 的“AI 主链路”才算真正打通；
- 病虫害识别作为第三条，接神农 API/MCP 与本地评测集。

在那之前，不应对外宣称“MVP 已完成”。
