# 兴隆沟村乡村振兴平台

以「农户内容 D2C · 数字化管理」为核心的乡村振兴平台，由两个独立运行、分别部署的子项目组成。设计源与开发期检查统一维护在仓库根目录，生成资源分别打包，无跨应用运行时依赖：

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

## 设计规范与质量检查

颜色、图标、布局、响应式、交互的唯一规范见 [设计系统](design-system/MASTER.md)，可打开 [组件与颜色样本](design-system/catalog.html)，实际检查结果见 [验证记录](design-system/verification.md)。构建请保留完整仓库，两个构建入口都会执行根目录设计门禁。

```sh
npm run design:sync   # 修改 design-system/tokens.json 或 icons.json 后生成资源
npm run check        # 快照/颜色/图标/对比度门禁 + 单元测试 + 两端构建
```

不要手改生成的 tokens.css、图标清单或 dist。角色主题统一登记，但角色导航、权限和业务逻辑仍独立维护。推送与 PR 会触发设计检查；不会自动部署。

## 部署

| 子项目 | 命令 |
| --- | --- |
| 官网 | `powershell -ExecutionPolicy Bypass -File web/deploy.ps1` |
| 工作台 | `powershell -ExecutionPolicy Bypass -File dashboard/deploy.ps1` |

两个子项目部署在同一 CloudBase 环境（`bigfish-2026-d4gixfnab6e09d0f2`）；前置依赖与故障排查见 [docs/wiki/04-部署与环境.md](docs/wiki/04-部署与环境.md)。

## 设计预演（非生产）

[`rehearsal/live-console/`](rehearsal/live-console/README.md) 用一条“农户提交蔬菜 → 入库员审核建批次 → 消费者溯源购买 → 调度/预警/审计”的最小业务，验证五角色权限边界、主动 Agent、PostgreSQL 事件队列与 CloudBase 部署：[在线控制台](https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/live/)。固定演示身份，未接登录，不代表生产系统。

## 文档导航

| 位置 | 内容 | 维护方式 |
| --- | --- | --- |
| [docs/wiki/](docs/wiki/README.md) | 项目 Wiki：总览、官网、工作台、角色权限、部署、架构流程 | Qoder 定时任务每小时随提交自动更新 |
| [docs/architecture/](docs/architecture/flow-evidence.md) | 登录/授权流程 PlantUML 时序图、逐段代码证据、风险清单 | 场景分析时更新 |
| [docs/blueprint/](docs/blueprint/乡村智能系统蓝图-2026.md) | 2026—2028 智能系统蓝图：角色化 Agent 契约、事件架构、场景优先级与三阶段路线图 | 阶段评审时更新 |
| [GitHub Wiki](https://github.com/jackuboot/xinglonggou-village/wiki) | 面向新成员的上手文档：快速开始、部署指南 | 手动维护（与 docs/wiki 互补，不重复深入内容） |

> 深入架构与规则以 `docs/wiki/` 为准；`docs/wiki/` 由自动化任务维护，人工上手教程留在 GitHub Wiki。
