# 兴隆沟村乡村振兴平台 · Wiki

> 本 wiki 由 Qoder 定时自动化维护：每小时检查一次仓库新提交，分析变更后自动更新受影响页面并提交（提交前缀 `docs(wiki):`）。`.sync-marker` 记录最后同步的 commit。

## 项目定位

兴隆沟村乡村振兴平台，以「农户内容 D2C · 数字化管理」为核心，由两个完全独立的子项目组成，无共享代码与依赖：

| 子项目 | 定位 | 技术栈 | 线上地址 |
| --- | --- | --- | --- |
| `web/` | 官网（SEO 静态站） | 原生 HTML/CSS/JS + 自研微模板构建脚本 | `…tcloudbaseapp.com/9e3840e6-7054-452d-b9f5-5462917056e2/` |
| `dashboard/` | 数字工作台（五角色应用） | Vue 3 + vue-router(hash) + Vite + 腾讯云 CloudBase | `…tcloudbaseapp.com/app/` |

两个子项目部署在**同一个 CloudBase 环境**（环境 ID：`bigfish-2026-d4gixfnab6e09d0f2`）的静态托管下，官网在子路径、工作台在 `/app/`。

## 页面索引

| 页面 | 职责范围 | 对应代码 |
| --- | --- | --- |
| [01-官网-web.md](01-官网-web.md) | `web/` 子项目全部：内容模型、构建、SEO、部署 | `web/` |
| [02-工作台-dashboard.md](02-工作台-dashboard.md) | `dashboard/` 架构：分层、路由、懒加载、网关流程 | `dashboard/src/` |
| [03-角色与权限.md](03-角色与权限.md) | 五角色模型、授权存储、云函数安全设计 | `dashboard/src/core/roles.js`、`cloudfunctions/roles-admin/` |
| [04-部署与环境.md](04-部署与环境.md) | 环境信息、部署脚本、引导脚本、诊断工具 | `*/deploy.ps1`、`dashboard/scripts/` |

## 业务闭环（一图流）

```
农户生产(farmer) → 入库员入库/代理发布(keeper) → 消费者预约使用(consumer) → 审计员核查(auditor)
                                                      ↑ 所有登录用户默认即消费者
管理后台(admin)：用户授权与系统管理（独立于四角色闭环）
```

## 维护约定（自动化执行依据）

- 每个页面的「职责范围」即自动化判断是否需要更新的依据：提交只涉及某目录时，只改对应页面。
- 每次同步在受影响页面末尾「同步记录」追加一行，格式：`- YYYY-MM-DD 同步至 <short-hash>：<一句话摘要>`。
- 新增顶层模块时新建页面并更新本索引表。
- wiki 内容必须来自真实代码与提交记录，不臆测。
