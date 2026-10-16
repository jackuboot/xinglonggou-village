# 兴隆沟村乡村振兴平台

以「农户内容 D2C · 数字化管理」为核心的乡村振兴平台，由两个完全独立的子项目组成（无共享代码与依赖）：

| 子项目 | 定位 | 技术栈 | 在线地址 |
| --- | --- | --- | --- |
| `web/` | 官网（SEO 静态站，内容驱动：改 `content/site.json` 即上线） | 原生 HTML/CSS/JS + 自研微模板构建脚本 | [CloudBase](https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/9e3840e6-7054-452d-b9f5-5462917056e2/) · [Qoder Sites](https://xinglonggou-it8h6ik8us5.qoder.website) |
| `dashboard/` | 数字工作台（农户/入库员/消费者/审计员/管理后台五角色） | Vue 3 + vue-router(hash) + Vite + 腾讯云 CloudBase | [CloudBase `/app/`](https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/app/) |

## 业务闭环

```
农户生产(farmer) → 入库员入库/代理发布(keeper) → 消费者预约使用(consumer) → 审计员核查(auditor)
                                                      ↑ 所有登录用户默认即消费者
管理后台(admin)：用户授权与系统管理（独立于四角色闭环）
```

## 快速开始

```powershell
# 官网：零依赖，构建 + 本地预览
cd web && node scripts\build.js && node scripts\serve.cjs   # http://localhost:8080

# 工作台：安装依赖后启动开发服务器
cd dashboard && npm install && npm run dev                  # http://localhost:5173
```

更多本地开发说明见 [GitHub Wiki · 快速开始](https://github.com/jackuboot/xinglonggou-village/wiki)。

## 部署

| 子项目 | 命令 |
| --- | --- |
| 官网 | `powershell -ExecutionPolicy Bypass -File web/deploy.ps1` |
| 工作台 | `powershell -ExecutionPolicy Bypass -File dashboard/deploy.ps1` |

两个子项目部署在同一 CloudBase 环境（`bigfish-2026-d4gixfnab6e09d0f2`）；前置依赖与故障排查见 [docs/wiki/04-部署与环境.md](docs/wiki/04-部署与环境.md)。

## 文档导航

| 位置 | 内容 | 维护方式 |
| --- | --- | --- |
| [docs/wiki/](docs/wiki/README.md) | 项目 Wiki：总览、官网、工作台、角色权限、部署、架构流程 | Qoder 定时任务每小时随提交自动更新 |
| [docs/architecture/](docs/architecture/flow-evidence.md) | 登录/授权流程 PlantUML 时序图、逐段代码证据、风险清单 | 场景分析时更新 |
| [GitHub Wiki](https://github.com/jackuboot/xinglonggou-village/wiki) | 面向新成员的上手文档：快速开始、部署指南 | 手动维护（与 docs/wiki 互补，不重复深入内容） |

> 深入架构与规则以 `docs/wiki/` 为准；`docs/wiki/` 由自动化任务维护，人工上手教程留在 GitHub Wiki。
