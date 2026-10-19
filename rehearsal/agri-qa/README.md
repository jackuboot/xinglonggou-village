# 农事问答最小实现（agri-qa）

> 对应设计验证：[../minimal-validation.md](../minimal-validation.md)。
> 目的：用最小实现验证**工程正确性**与**架构正确性**，不是生产代码。

## 业务

农户问：“我家 3 组的茶树叶发黄怎么办？”
Agent 读取本人地块 → 检索知识 → 可选病虫害识别 → 生成带引用的回答；低置信度/无引用/越权时升级人工。

## 验证的架构点

| 架构点 | 实现 | 测试 |
| --- | --- | --- |
| 身份与行级权限 | 工具网关校验 `ownerUid` | 跨用户被拒并升级 |
| 工具白名单 | `plot.query` / `knowledge.search` / `pest.detect` | 非白名单工具拒绝 |
| RAG 引用 | 知识命中 → 引用；无命中升级 | 无引用用例 |
| 模型网关 | 可替换的 `ModelGateway`，失败保留检查点 | 失败后重试从断点继续 |
| 人工中断 | 低置信度/无引用 → `escalated` + 审计 | 低置信度用例 |
| 会话 Actor | 同 thread 串行、不同 thread 隔离 | 串行顺序用例 |
| 检查点 | 每阶段保存，按 `threadId` 恢复 | 模型失败恢复用例 |
| 监测 | 接收/工具调用/人工升级/关闭事件 | 事件序列断言 |

## 明确是模拟的部分

- ASR：未接真实方言识别，问题以文本传入；
- 模型：`StubModelGateway` 按知识条目拼回答；
- 病虫害：`StubPestDetector` 返回固定置信度；
- 知识库：内存关键词匹配，不是 pgvector；
- 运行时：进程内 Actor，不是长驻容器；
- 部署：未部署 CloudBase。

这些替换点都有端口（`ModelGateway`、`PestDetector`、`KnowledgeSearch`、`Checkpointer`），正式实现只换适配器。

## 运行

```bash
cd rehearsal/agri-qa
npm install
npm test
npm run typecheck
npm run demo
```

## 结构

```
src/
  domain/      Result、错误码、状态与事件类型、风险判断
  ports/       工具/模型/检查点/监测/时钟等接口
  adapters/    内存实现与模拟模型、病虫害、知识库
  application/ 工具网关、会话 Actor、问答用例
  index.ts     演示
tests/         业务用例 + 架构约束用例
```

## 边界

- 只读业务，不写地块/订单；
- 回答必须带引用，否则升级；
- 越权不泄露地块是否存在；
- 所有工具调用与升级都有监测事件。
