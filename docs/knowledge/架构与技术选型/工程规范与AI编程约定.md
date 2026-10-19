# 工程规范与 AI 编程约定（v0.8）

> 阅读顺序与权威优先级：见本目录《00 · 阅读顺序与权威优先级》；冲突时按该文裁决。

> 目的：让代码对人、对 AI、对工具都**可预测**。命名与字段的一致性不是风格问题，而是可维护性和 Agent 可理解性的基础设施。
> 适用范围：`web/`、`dashboard/`、`cloudfunctions/`、未来的 Agent 服务与数据管道。
> 生效方式：设计阶段定稿；实现阶段通过 CI 与评审强制执行。

## 一、语言与框架（ADR-005）

| 层 | 选择 | 理由 | 边界 |
| --- | --- | --- | --- |
| 官网构建脚本 | TypeScript + Node.js | 类型约束、AI 生成质量高、与工作台同语言 | 纯静态构建，不引入框架 |
| 数字工作台 | **TypeScript + Vue 3 + Vite** | 存量栈延续；类型可被 AI 与工具检查 | 新代码必须 TS，存量 JS 触碰时逐步迁移 |
| 云函数（请求面） | **TypeScript on Node.js（CloudBase）** | 无状态、短请求、部署简单 | 不承载长会话/流式；不引入常驻进程 |
| Agent 运行时（运行面） | **TypeScript + LangGraph.js，长驻容器** | 稳定进程、WebSocket/SSE、会话常驻 | 见 ADR-008；CloudBase 云托管优先 |
| 运行时校验 | **Zod** | schema 即文档、即校验、即类型 | 所有外部输入必须经过 schema |
| 单元/集成测试 | **Vitest** | 与 Vite 同生态、启动快 | 覆盖纯函数与 schema |
| E2E 测试 | **Playwright** | 跨浏览器、可录屏、AI 易生成 | 只跑关键路径 |
| 离线训练/评测 | **Python（PyTorch）独立目录** | 生态成熟 | 不进入运行时，不参与业务服务 |

规则：

1. 新增代码一律 TypeScript（`strict: true`），禁止新增 `.js` 业务文件；
2. 不新增框架或大型依赖，除非有 ADR 记录理由与替代方案；
3. 不引入元编程、隐式魔法或自研 DSL；显式优于聪明；
4. Python 默认只用于离线训练、标注、评测；若 ADR-007 触发 Python 运行时回退，必须单独 ADR 评审并同步调整本节边界。

## 二、命名规范（AI 友好）

原则：**一个概念只有一个名字**；英文标识符 + 中文展示文案；不用缩写；不用同义词。

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| 目录 | kebab-case | `agent-orchestrator/` |
| 普通 TS 文件 | kebab-case | `plot-submit-flow.ts` |
| Vue 组件文件 | PascalCase | `RoleHome.vue` |
| 变量 / 函数 | camelCase | `submitPlotDraft`、`getGrantedRoles` |
| 类型 / 组件 | PascalCase | `PlotDraft`、`RoleHome.vue` |
| 常量 | SCREAMING_SNAKE_CASE | `MAX_PLOT_AREA` |
| 数据库表 | snake_case、复数 | `plots`、`agent_tasks` |
| 数据库字段 | snake_case | `owner_uid`、`created_at` |
| 主键 / 外键 | `id` / `<entity>_id` | `id`、`plot_id` |
| 外部 HTTP 路径（可选） | `/api/v1/<resource>` | `/api/v1/plots` |
| 内部 action | `<domain>.<verb>` | `plot.submit`、`batch.create` |
| 事件 | `<domain>.<entity>.<past_verb>` | `plot.submitted`、`batch.created` |
| Agent ID | kebab-case、角色前缀 | `farmer-copilot`、`audit-copilot` |
| Agent 工具 | `<domain>.<verb>` | `pest.detect`、`knowledge.search` |
| 错误码 | 大写下划线、域前缀 | `PLOT_DUPLICATE`、`AUTH_UNAUTHORIZED` |

### 领域术语表（唯一合法名称）

| 概念 | 代码名 | 禁止使用 | 中文展示 |
| --- | --- | --- | --- |
| 农户 | `farmer` | grower、peasant、user | 农户 |
| 地块 | `plot` | land、field、parcel | 地块 |
| 作物 | `crop` | plant、culture | 作物 |
| 产品 | `product` | goods、item、sku | 产品 |
| 批次 | `batch` | lot、group | 批次 |
| 入库 | `intake` | stock-in、inbound | 入库 |
| 质检 | `inspection` | qc、check | 质检 |
| 订单 | `order` | purchase、deal | 订单 |
| 预约 | `booking` | reservation、appointment | 预约 |
| 服务工单 | `service_ticket` | service order、task | 服务工单 |
| 文化资源 | `culture_asset` | cultural item、heritage | 文化资源 |
| 知识条目 | `knowledge_entry` | kb item、doc | 知识条目 |
| Agent 任务 | `agent_task` | job、run | Agent 任务 |
| 审计记录 | `audit_log` | log、record | 审计记录 |

> 新概念入表后才能写代码；已有代码中的同义名在触碰时收敛。代码实体名用单数，数据库表名用复数（如 `agent_task` → `agent_tasks`）。

## 三、错误码与常量

### 错误码

格式：`<DOMAIN>_<REASON>`，全部大写。统一注册在 `shared/error-codes.ts`，**禁止在业务代码里写字面量错误信息**。

| 域 | 号段 | 示例 |
| --- | --- | --- |
| AUTH | 1000–1999 | `AUTH_UNAUTHORIZED`、`AUTH_FORBIDDEN` |
| PLOT | 2000–2999 | `PLOT_DUPLICATE`、`PLOT_NOT_OWNED` |
| PRODUCT/BATCH | 3000–3999 | `BATCH_INVALID_STATUS`、`PRODUCT_MISSING_FIELD` |
| ORDER/SERVICE | 4000–4999 | `ORDER_ALREADY_PAID`、`SERVICE_TICKET_CLOSED` |
| AGENT | 5000–5999 | `AGENT_SCOPE_DENIED`、`AGENT_TOOL_FAILED` |
| DATA | 6000–6999 | `DATA_SCHEMA_INVALID`、`DATA_LICENSE_MISSING` |
| CULTURE/KNOWLEDGE | 7000–7999 | `CULTURE_ASSET_NOT_FOUND`、`KNOWLEDGE_ENTRY_INVALID` |
| SYSTEM | 9000–9999 | `SYSTEM_TIMEOUT`、`SYSTEM_RATE_LIMITED` |

每个错误码必须声明：`code`、`httpStatus`、`retryable`、`messageKey`、`userMessageZh`。错误码只增不改；废弃需标记 `deprecated`。

### 常量

- 单一来源：`shared/constants/<domain>.ts`；
- 使用 `as const` 对象 + 联合类型，不用裸字符串；
- 禁止魔法数字与散落的状态字符串；
- 状态值必须有唯一名称，例如 `PlotStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'active'`。

## 四、字段一致性

1. **Schema 先行**：新增或修改字段必须同时更新 `Zod schema`、数据库迁移、数据字典三处；缺一不可。
2. **一词一义**：同一概念只允许一个字段名；禁止 `status` 与 `state` 并存、`owner_id` 与 `farmer_id` 并存。
3. **只增不删**：破坏性变更需要 ADR；先加新字段并双写，再迁移，最后废弃旧字段。
4. **字段后缀约定**：时间用 `_at`，布尔用 `is_` / `has_`，金额用 `_amount` 并配 `currency`，数量用 `_count`。
5. **跨层同名**：数据库、API、事件中的字段名保持一致，只在边界做映射。
6. **禁止随意增减**：任何字段变更必须走"提案 → 数据字典 → schema/迁移 → 契约测试 → 评审"。

## 五、函数式编程与模块化

### 函数式编程约定

1. **纯函数优先**：`domain` 层只做"输入 → 输出"，不读写数据库、网络、时间、随机数；副作用集中在 `adapters`。
2. **不可变**：不修改入参；使用 `const`、`readonly`、展开运算符；禁止原地修改业务数据（`push/splice/delete`）。Vue 响应式容器的原地操作仅限 `ui/` 层。
3. **组合优于继承**：用小函数组合完成业务；不用 class 表达业务模型（Vue 组件与框架对象如 `StateGraph` 除外）。
4. **显式依赖**：依赖通过参数注入，不用全局单例、隐式上下文或模块级可变状态。
5. **错误即值**：业务错误返回 `Result<T, E>`（判别联合），不用异常控制流程；只有基础设施异常可以抛出，并在边界统一转换。
6. **副作用隔离**：时间、随机数、ID 生成、I/O 都通过接口注入，便于测试、回放与审计。

### 分层与依赖方向

```
domain/        纯业务规则与类型（无 I/O）
application/   用例编排（调用 domain + ports）
adapters/      CloudBase / HTTP / 存储实现（实现 ports）
ui/            Vue 页面与组件（只调用 application）
shared/        types / errors / constants（无业务逻辑）
```

依赖方向：`ui → application → domain`；`adapters` 实现 `domain/application` 定义的接口；**domain 不能依赖任何外层**；禁止循环依赖。

### 模块化硬约束

| 约束 | 上限 | 说明 |
| --- | --- | --- |
| 单文件行数 | **≤1000 行（硬性）**，建议 ≤500 | 超过必须按职责拆分；自动生成文件除外 |
| 单函数行数 | ≤50 行 | 超过提取子函数 |
| 参数个数 | ≤4 个 | 超过改为对象参数 |
| 嵌套层级 | ≤3 层 | 超过用提前 return 或提取函数 |
| 目录职责 | 一个目录一个领域或特性 | 禁止 `misc/`、`utils/` 变成垃圾袋 |

拆分方法：按"输入解析 → 领域规则 → 副作用 → 输出组装"四段拆；一个文件一个主要导出；文件名体现职责（`plot-submit.ts`、`batch-review.ts`），不用 `helpers.ts` 这类无意义名称。

## 六、Agent 编排框架约定（LangGraph）

**定位**：LangChain 负责模型与工具适配，**LangGraph 负责图编排、状态、中断与回放**。只允许出现在 `application/orchestration` 层，`domain` 保持框架无关，禁止把 LangChain 类型泄漏到领域模型或 API。

### 状态契约

- 每个 Agent 的 State 用 **Zod schema** 定义，字段必须来自数据字典，禁止临时字段；
- 合并规则（reducer）显式声明：消息追加、列表追加、值覆盖，不允许隐式合并；
- State 带 `schema_version`，变更按"只增不删"处理；
- 框架类型（`MessagesAnnotation` 等）只能在编排层内部使用。

### 线程与记忆

- `thread_id` 规则：`<village_id>:<role>:<user_id>:<conversation_id>`，禁止跨用户或跨角色复用；
- Checkpointer 使用 **PostgreSQL**（`@langchain/langgraph-checkpoint-postgres`），表统一前缀 `langgraph_`；
- 对话状态与长期记忆分开：长期记忆进入 `knowledge_entry` / 用户画像，需审核；
- 检查点含个人信息时必须加密/脱敏，并设定保留期与清理任务。

### 人工介入与回放

- LangGraph 的 `interrupt` 对应蓝图中的审批矩阵：写操作、对外发布、交易相关动作必须中断等人；
- 恢复执行必须校验操作者权限，并写入审计事件；
- time travel 只用于审计、调试与故障复现；业务回滚必须走审批，不得直接改写线上状态。

### 工具与边界

- 所有工具调用经 **工具网关**，白名单来自 Agent 契约卡；禁止直接把任意 LangChain tool 绑定给模型；
- Checkpointer 属于基础设施适配器，不是工具；使用专用数据库角色，只写 `langgraph_*` 表；
- 工具参数与返回值必须有 Zod schema；失败返回标准错误码；
- 节点内部业务错误用 `Result`，向图返回增量；基础设施异常在节点边界转换，不把异常当流程控制；
- 单次任务设置最大步数、超时与预算，防止图无限循环。

### 部署与运行时

- Agent 运行面部署在**长驻容器**（CloudBase 云托管优先，ADR-008）；云函数只承载请求面，不跑图编排；
- 人工中断不占进程：状态落 PostgreSQL，恢复通过新请求 + 同一 `thread_id`；
- 版本锁定（lockfile），升级需 ADR 与回归评测。

### 模块化

- 每个 Agent 一个 graph 定义文件；节点按职责拆分（检索、推理、工具、校验、交付）；
- 单文件 ≤1000 行、单函数 ≤50 行，与第五节约束一致；
- 图级测试使用 fake tools，覆盖正常、失败、中断、恢复四条路径。

## 七、Agent 运行时与 Actor 约束

### 请求面与运行面分离

- **云函数**：只做无状态、短生命周期的请求（CRUD、鉴权、webhook），不承载长会话、流式输出；
- **Agent 运行时**：长驻容器服务（CloudBase 云托管优先，TKE 备选），支持 WebSocket/SSE；会话在进程内活跃，空闲或故障后按 `thread_id` 从检查点重建；
- 两边通过 API/事件通信；运行面不向客户端暴露数据库连接，写操作经工具网关/受控适配器；checkpointer 使用专用账号与 `langgraph_*` 表。

### 会话 Actor

- Actor ID = `thread_id`；**同一会话单写者**，消息按邮箱 FIFO 串行处理；
- 不同会话可并行；禁止跨会话共享可变内存或全局单例；
- 每条消息带 `message_id`，处理幂等；重复投递不产生重复副作用；
- 空闲会话可驱逐：先落检查点再释放进程，恢复时按 `thread_id` 重建。

### 隔离与公平

- 每个会话有配额：最大步数、token 预算、工具调用次数、单步超时；
- 队列深度与等待时间设告警，单会话不得拖垮其他会话；
- 高价值或监管场景可配置独占实例，默认使用逻辑隔离以控制成本。

### 恢复与一致性

- 每个节点执行后写检查点；崩溃后从最近检查点恢复，不从头重跑；
- 工具调用必须幂等（幂等键），恢复时不得重复扣库存、重复发通知；
- 会话迁移需先握手：旧 worker 停止接收新消息、完成当前步、落检查点，再由新 worker 接管。

### 部署与观测

- 优先 CloudBase 云托管；规模上来再评估 TKE 或腾讯云 Agent Runtime；
- 云托管可缩容到 0：活跃会话保留最小实例；空闲会话先落检查点再驱逐，恢复时按 `thread_id` 重建；
- 滚动发布要支持优雅下线（drain）：停止接单、完成在途步骤、落检查点；
- 每个会话输出 trace：排队时长、每步耗时、检查点大小、心跳与失败原因；
- 网关统一鉴权，运行时只接受带能力令牌的请求。

## 八、AI 编程约定

- 交付顺序遵循《AI 时代架构与交付方法》：需求 → schema → 用例 → 实现 → 能力暴露 → E2E；P0 无用例不实现；

- 模块小而显式：一个文件一个职责，导出类型与函数（Vue SFC 的 default export 视为该文件主要导出）；
- 所有公共函数标注输入/输出类型，禁止 `any`；
- 注释解释"为什么"，不重复"做了什么"；
- 测试即规格：用例名写清前置、动作、预期；
- Agent 的契约、工具参数、提示词模板都存为 schema/配置文件，不埋在代码字符串里；
- 不写"聪明"的抽象；可读性优先于复用。

## 九、强制检查（CI / 评审门禁）

| 检查 | 工具 | 门禁 |
| --- | --- | --- |
| 类型检查 | `tsc --noEmit` | 必须通过 |
| 命名与风格 | ESLint（naming-convention） | 必须通过 |
| 外部输入校验 | Zod contract tests | 必须通过 |
| 数据库变更 | 迁移脚本检查 | 缺迁移拒绝合并 |
| 关键流程 | Playwright E2E | P0 用例必须通过 |
| 字段变更 | PR 清单 + 数据字典 diff | 未更新字典拒绝合并 |
| 文件行数 | ESLint `max-lines` | >1000 行拒绝合并，>500 行警告 |
| 函数行数 | ESLint `max-lines-per-function` | >50 行拒绝合并 |
| 依赖方向 | `import/no-cycle` + dependency-cruiser | 分层违规或循环依赖拒绝合并 |
| 目录结构 | 评审清单 | 职责不清或垃圾袋目录拒绝合并 |

## 十、存量迁移策略

- 工作台现有 JS 不搞一次性重写；新文件用 TS，触碰旧文件时顺带迁移；
- `roles-admin` 的现有 action（`me/status/bootstrap/list/grant/revoke`）冻结为**存量接口**，只修 bug 不加能力；新能力先定义契约，前端继续用 `callFunction`，外部/Agent 需要时再暴露 HTTP/MCP 适配器（见《开放决策处理记录》D-03）；
- 现有 `user_roles` 表保留；新表按 snake_case 复数命名；
- 每次迁移在 PR 中标注"无行为变更"。

## 十一、待确认

- 云函数 TS 构建方式（tsc 预编译 or esbuild 打包）；
- 是否引入共享 types 包（`shared/`）及其发布方式；
- 数据库迁移工具选型（CloudBase 原生迁移 or 自定义脚本）。
