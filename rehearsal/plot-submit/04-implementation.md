# 04 · 实现设计

## 目录与分层

```
src/
  domain/       纯类型、Zod schema、错误、Result
  application/  用例编排（提交、审核、AI 预填）
  ports/        仓储、审计、时钟、ID 接口
  adapters/     内存实现（正式替换为 PostgreSQL / CloudBase）
tests/          契约、业务、AI 工具测试
```

依赖方向：`application → domain/ports`；`adapters` 实现 `ports`；`domain` 不依赖任何外层。

## 用例流程

### 提交

```
输入(unknown) → Zod 严格校验 → 查幂等键
  → 已存在：返回已有记录（不重复审计）
  → 不存在：生成 id/时间 → 状态 submitted → 保存 → 写 plot.submitted → 返回
```

### 审核

```
输入 → Zod 校验 → 角色检查（keeper/admin）
  → 数据范围检查（keeper 本村）
  → 版本检查 → 状态检查 → 驳回原因检查
  → 更新状态/版本 → 保存 → 写 approved/rejected → 返回
```

## 错误码（字符串，新函数规范）

| 错误码 | 含义 | 可重试 |
| --- | --- | --- |
| `PLOT_INVALID_INPUT` | 入参不合法 | 否 |
| `PLOT_FORBIDDEN` | 角色或数据范围不允许 | 否 |
| `PLOT_NOT_FOUND` | 地块不存在 | 否 |
| `PLOT_INVALID_STATUS` | 当前状态不可操作 | 否 |
| `PLOT_REJECT_REASON_REQUIRED` | 驳回未填原因 | 否 |
| `PLOT_VERSION_CONFLICT` | 版本冲突 | 是 |

## 云函数映射（正式实现）

```js
// 云函数范围 A：不使用 REST 路径
exports.main = async (event, context) => {
  const uid = getUidFromContext(context) // TCB_UUID
  switch (event.action) {
    case 'plot.submit':
      return toEnvelope(await submitPlot({ ...event.payload, actorUid: uid }, deps))
    case 'plot.review':
      return toEnvelope(await reviewPlot({ ...event.payload, actorUid: uid }, deps))
  }
}
```

- 入参：`event.action` + `event.payload`；
- 身份：只取上下文；
- 返回：`{ ok: true, data }` / `{ ok: false, code, message, retryable }`；
- 外部 HTTP 如需暴露，由独立适配函数转换，不在本函数内模拟路径。

## 适配器替换

当前 `InMemoryPlotRepository` / `InMemoryAuditLog`；正式实现替换为 PostgreSQL 仓储，接口不变。测试仍可在内存适配器上运行。

## 文件规模

- 单文件均 <100 行；单函数 <50 行；无跨层依赖；
- 业务错误用 `Result`，不抛异常。
