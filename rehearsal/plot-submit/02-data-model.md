# 02 · 数据模型

## 实体：地块（plot）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | string | PK | 地块 ID |
| `owner_uid` | string | 必填 | 归属农户，行级权限依据 |
| `village_id` | string | 必填 | 村 ID，为多村预留 |
| `group_name` | string | 1–50 字 | 村组 |
| `area_mu` | number | >0，≤10000 | 面积（亩） |
| `crop` | string | 1–50 字 | 主要作物 |
| `status` | enum | 见状态机 | 生命周期 |
| `version` | integer | ≥1 | 并发控制 |
| `idempotency_key` | string | 8–128，唯一 | 幂等键 |
| `created_at` | timestamptz | 必填 | 创建时间 |
| `updated_at` | timestamptz | 必填 | 更新时间 |

数据库表名按规范为 `plots`，字段 snake_case；代码内实体用 camelCase，边界映射。

## 状态机

```
draft → submitted → under_review → approved → active
                         ↓
                      rejected → draft（修改后重提）
active → change_pending → active
```

预演实现覆盖 `submitted → active / rejected`；其余状态在正式实现补齐。

## 权限与数据范围

| 操作 | 角色 | 数据范围 |
| --- | --- | --- |
| 提交 | farmer | 本人 |
| 审核 | keeper / admin | keeper 本村；admin 全量 |
| 查看 | 本人 / keeper 本村 / auditor 全量只读 | 行级 |
| 审计 | auditor | 全量只读 |

身份只来自云函数上下文，客户端传参不可信。

## 幂等与并发

- 提交：`idempotency_key` 唯一；重复提交返回已有记录，不重复写审计；
- 审核：`expected_version` 与当前 `version` 必须一致，否则返回 `PLOT_VERSION_CONFLICT`。

## 审计事件

```json
{
  "eventId": "evt-1",
  "type": "plot.submitted | plot.approved | plot.rejected",
  "occurredAt": "2026-10-19T00:00:00.000Z",
  "actorUid": "farmer-001",
  "traceId": "trace-001",
  "payload": { "plotId": "id-1", "decision": "approve", "reason": "" }
}
```

## 示例数据（fixture）

```json
{
  "actorUid": "farmer-001",
  "villageId": "village-xinglonggou",
  "groupName": "3组",
  "areaMu": 5.5,
  "crop": "茶",
  "idempotencyKey": "submit-plot-0001",
  "traceId": "trace-001"
}
```
