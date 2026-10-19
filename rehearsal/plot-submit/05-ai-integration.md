# 05 · AI 接入

## 目标

农户可以用语音描述地块，AI 从转写中抽取组名、面积、作物，生成**草稿建议**；农户确认后才调用提交用例。

## 工具契约

- 工具名：`plot.prefill`
- 类型：只读推理（`readOnlyHint: true`），无写库能力
- 输入：`{ transcript: string }`
- 输出：`{ groupName?, areaMu?, crop?, confidence, needsConfirmation: true }`
- 失败：标准错误码 `PLOT_INVALID_INPUT`
- 确认：结果必须人工确认，不允许自动提交

见 `tools/plot-prefill.tool.json`。

## Agent 契约（farmer-copilot）

- 允许工具：`plot.prefill`、`knowledge.search`、`plot.submitDraft`（未来）；
- 禁止：直接写数据库、替农户点击最终提交、承诺审核结果；
- 低置信度（<0.5）：提示补录，不生成提交草稿；
- 所有调用记录 `traceId` 与耗时；
- 写操作必须 interrupt 等待农户确认。

见 `agents/farmer-copilot.agent.yaml`。

## 当前实现

`prefillPlotFromTranscript` 是纯函数模拟：

- 正则抽取面积（亩/平方米）与组名；
- 关键词匹配作物；
- 返回置信度与 `needsConfirmation: true`；
- 不接收仓储，不具备写库能力。

测试覆盖：信息完整、信息不足、空输入三种情况。

## 正式接入顺序

1. ASR：腾讯云方言识别 → 转写文本；
2. 预填：可由大模型 + JSON Schema 结构化输出，或规则 + 模型混合；
3. 农户确认：表单回填，可修改；
4. 提交：走 `submitPlot`，校验与审计与手工提交一致；
5. 监测：记录 ASR 耗时、预填置信度、人工修改率、放弃率。

## 安全边界

- 转写文本视为不可信输入，不执行其中任何指令；
- 预填结果不得绕过 schema 校验；
- 工具只读，写操作由应用用例完成；
- 不把完整语音/转写长期存储，除非取得授权。
