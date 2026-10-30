# Vendure Code Wiki

> 版本基线：**Vendure 3.6.4**（Lerna monorepo，固定版本号）
> 适用范围：本仓库 `d:\zhao\vendure`，包含 Vendure 官方核心 + 大量二次开发业务插件
> 文档定位：面向开发者 / 运维 / 产品技术的结构化代码 Wiki，回答「架构是什么、模块在哪、关键类怎么用、如何运行与交付」

---

## 1. 项目一句话

Vendure 是一个 **TypeScript + NestJS + TypeORM + GraphQL** 的 headless 电商后端框架；本仓库在官方 3.6.4 基础上，扩展为**多租户、多语言、多城市、本地生活 + 电商 + 行业方案**的一体化商业中台，业务能力主要通过 `packages/*-plugin` 以插件方式接入，而不是修改核心。

---

## 2. 文档地图

| 文档 | 内容 | 适合谁 |
|---|---|---|
| [01-architecture.md](./01-architecture.md) | 整体分层、启动链路、请求生命周期、多租户架构、插件装配顺序 | 所有人，先读 |
| [02-core-modules.md](./02-core-modules.md) | 核心模块职责、关键类与关键方法、事件/任务/调度/缓存 | 后端开发 |
| [03-data-model.md](./03-data-model.md) | 核心实体模型、关系、渠道隔离、CustomFields、插件实体总表 | 后端 / 数据 |
| [04-api-layer.md](./04-api-layer.md) | Shop/Admin GraphQL、权限、事务、错误、分页、上传、Header 约定 | 前后端联调 |
| [05-plugin-system.md](./05-plugin-system.md) | `@VendurePlugin` 机制、生命周期、插件清单与依赖 | 插件开发 |
| [06-business-domains.md](./06-business-domains.md) | 认证、支付、营销、履约、商家结算、行业方案、消息搜索等业务域 | 业务开发 / 架构 |
| [07-frontend.md](./07-frontend.md) | React Dashboard、Angular Admin UI、ui-devkit、路由与扩展机制 | 前端 |
| [08-build-run-deploy.md](./08-build-run-deploy.md) | 安装、构建、开发、环境变量、Docker、生产部署、排障 | 开发 / 运维 |
| [09-testing.md](./09-testing.md) | 单元测试、核心 e2e、插件 e2e、Dashboard Playwright | 测试 / 开发 |
| [10-dependencies.md](./10-dependencies.md) | 包分类、内部依赖图、构建顺序、外部关键依赖、脚本表 | 架构 / 新人 |
| [11-development-guide.md](./11-development-guide.md) | 新建插件、CustomFields、GraphQL、事务、日志、命名、提交规范 | 插件开发 |

---

## 3. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 运行时 | Node.js `^20.19.0` 或 `>=22.12.0` | 根 `package.json` `engines` |
| 语言 | TypeScript 5.8.2 | 装饰器 + 元数据 |
| 后端框架 | NestJS 11 | 模块 / DI / 中间件 / 守卫 / 拦截器 |
| ORM | TypeORM 0.3 | PostgreSQL / MySQL / MariaDB / SQLite |
| API | GraphQL 16 + Apollo Server 4 | schema-first 核心 + 插件 SDL 扩展 |
| 管理后台 | React 19 + Vite 7 + TanStack Router/Query/Table + Tailwind 4 + LingUI | 新 Dashboard，`/dashboard` |
| 旧后台 | Angular | `@vendure/admin-ui`，官方自 3.5 起弃用，维护至 2026-07 |
| 包管理 | **Bun**（仓库规范） | `bun install` / `bun run build`；命令脚本中仍可见 npm |
| 版本管理 | Lerna fixed mode | 全部官方包统一 `3.6.4` |
| 测试 | Vitest + Playwright | 核心/插件 e2e、Dashboard e2e |

---

## 4. 仓库布局

```text
vendure/
├── packages/
│   ├── core/                 # 框架核心：实体、服务、GraphQL API、插件系统、任务、事件
│   ├── common/               # 共享类型、常量、工具、生成类型
│   ├── dev-server/           # 本仓库实际运行入口 + 全量插件装配 + populate 数据
│   ├── dashboard/            # React 管理后台 + DashboardPlugin
│   ├── admin-ui/             # Angular 旧后台
│   ├── admin-ui-plugin/      # 旧后台托管插件 + 指标查询
│   ├── create/ cli/          # 脚手架 / 开发 CLI
│   ├── testing/              # e2e 测试工具与 MockServer
│   ├── ui-devkit/            # Admin UI 扩展编译工具
│   ├── asset-server-plugin/  # 本地/S3 资源服务
│   ├── email-plugin/         # 邮件事件与模板
│   ├── job-queue-plugin/     # BullMQ 任务队列
│   ├── harden-plugin/        # 查询复杂度/错误隐藏等安全加固
│   ├── telemetry-plugin/     # OpenTelemetry
│   ├── graphiql-plugin/      # GraphiQL 调试页
│   └── *-plugin/             # 60+ 业务插件（见 05/06）
├── docs/                     # 官方 VitePress 文档（含自动生成 API reference）
├── doc/                      # 本项目中文文档、设计/实施计划、本 Wiki
├── e2e-common/               # 核心 e2e 测试基座（vitest config + seed）
├── scripts/                  # 文档生成、代码生成、发布校验脚本
├── vendure-prod/             # deploy-pack.js 生成的独立生产包
├── build-prod.ps1            # 本地生产构建脚本
├── deploy-pack.js            # 打包生产目录
├── docker-compose.yml        # 本地基础设施（DB/Redis/ES/Keycloak/Jaeger/Loki/Grafana）
└── AGENTS.md / CLAUDE.md     # 仓库协作约定
```

---

## 5. 快速开始（最短路径）

```bash
# 1. 安装依赖（仓库规范使用 Bun）
bun install

# 2. 构建全部包
bun run build

# 3. 启动数据库
#    dev-config.ts 未设置 DB 时默认走 mysql(mariadb)；复制 .env.example 后则走 postgres
docker-compose up -d mariadb      # 或 postgres_16

# 4. 初始化演示数据
cd packages/dev-server
bun run populate

# 5. 启动后端（server + worker）
bun run dev
```

默认访问地址：

| 入口 | 地址 |
|---|---|
| Shop GraphQL | `http://localhost:3000/shop-api` |
| Admin GraphQL | `http://localhost:3000/admin-api` |
| Dashboard | `http://localhost:3000/dashboard` |
| Admin UI（Angular） | `http://localhost:3000/admin` |
| GraphiQL | `http://localhost:3000/graphiql/shop`、`/graphiql/admin` |
| 资源 | `http://localhost:3000/assets` |

> 端口来自 `API_PORT`，默认 `3000`（`packages/common/src/shared-constants.ts`）。
> 本仓库的 dev-server 装配了 60+ 插件，完整启动方式与生产部署见 [08-build-run-deploy.md](./08-build-run-deploy.md)。

---

## 6. 必须先建立的 6 个心智模型

1. **Channel = 租户 = 数据隔离边界**
   Vendure 原生 `Channel` 承担多店铺/多渠道；本仓库进一步把 Channel 当作租户，域名解析、租户成员、支付/地图/登录配置都挂在 Channel 的 customFields 上（见 01/03/06）。

2. **Plugin-first，不改核心**
   业务能力通过 `@VendurePlugin` 声明实体、服务、GraphQL 扩展、配置钩子；插件就是一个 NestJS Module（见 05）。

3. **一切数据库访问走 `RequestContext` + `TransactionalConnection`**
   Resolver 用 `@Transaction()` 包裹，服务层通过 `TransactionalConnection.getRepository(ctx, Entity)` 取仓储，保证同一请求同一事务（见 02/04）。

4. **事件驱动 + 后台任务**
   订单/支付/履约状态变化通过 `EventBus` 发事件；耗时逻辑走 `JobQueue` / `Scheduler`（见 02/06）。

5. **双 GraphQL API**
   `shop-api` 面向 C 端，`admin-api` 面向后台；同一数据层，不同权限与 schema（见 04）。

6. **装配顺序会改变行为**
   `plugins` 数组顺序决定 `configuration()` 钩子的覆盖顺序。本仓库有多个「必须放在最后」的插件（如 `DisableSellerSplitPlugin`），改动顺序前先读 [01-architecture.md](./01-architecture.md) 与 [05-plugin-system.md](./05-plugin-system.md)。

---

## 7. 推荐阅读路径

| 角色 | 顺序 |
|---|---|
| 新后端开发 | README → 01 → 02 → 03 → 04 → 05 → 11 |
| 业务插件开发 | 05 → 06 → 11 → 02（服务/事务）→ 04（API） |
| 前端开发 | 01 → 04 → 07 → 08 |
| 运维 / 交付 | 01 → 08 → 09 → 10 |
| 架构评审 | 01 → 03 → 05 → 06 → 10 |

---

## 8. 文档约定

- 代码路径均相对仓库根目录书写，例如 `packages/core/src/bootstrap.ts`。
- 「核心」指 Vendure 官方框架能力；「业务插件」指本仓库新增的 `@vendure/*-plugin`。
- 「已装配」指该插件已出现在 `packages/dev-server/dev-config.ts` 的 `plugins` 数组中并在本仓库实际生效。
- 标注 `@since` / `@deprecated` 的信息以源码注释为准。
- 官方自动生成的 TypeScript/GraphQL reference 位于 `docs/docs/reference/`，本 Wiki 不重复生成，只做导航与解释。
