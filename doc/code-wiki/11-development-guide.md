# 11 · 开发指南与编码规范

> 一句话理解：新增能力 = **新建一个 `@VendurePlugin` 包**；框架提供的入口（service/resolver/entity/customFields/migration/event/job）足以覆盖 99% 需求，不要改 `@vendure/core`。

---

## 1. 新建业务插件：10 步

以 `packages/xxx-plugin` 为例（参考 [packages/coupon-plugin](../../packages/coupon-plugin)）。

### 步骤 1：创建包结构

```
packages/xxx-plugin/
├── index.ts                 # 包入口，只做 re-export
├── package.json
├── tsconfig.json
├── tsconfig.build.json      # { extends: "./tsconfig.json", compilerOptions: { outDir: "./lib" }, files: ["./index.ts"] }
├── vitest.config.mts        # swc + useDefineForClassFields:false
└── src/
    ├── plugin.ts            # @VendurePlugin 定义
    ├── constants.ts         # loggerCtx + XXX_PLUGIN_OPTIONS Symbol
    ├── types.ts             # 选项接口、枚举、DTO
    ├── *.entity.ts
    ├── *.service.ts
    ├── *.resolver.ts
    ├── *.spec.ts
    └── migrations/
```

`index.ts` 只做导出，不要写逻辑：

```ts
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/coupon-template.entity';
export * from './src/coupon.service';
```

### 步骤 2：`package.json`

```jsonc
{
  "name": "@vendure/xxx-plugin",
  "version": "0.0.1",
  "license": "GPL-3.0-or-later",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**/*"],
  "scripts": {
    "watch": "tsc -p ./tsconfig.build.json --watch",
    "build": "rimraf lib && tsc -p ./tsconfig.build.json",
    "test": "vitest --config vitest.config.mts --run",
    "e2e": "cross-env PACKAGE=xxx-plugin vitest --config vitest.config.mts --run"
  },
  "peerDependencies": { "@vendure/core": "^3.6.0", "@vendure/common": "^3.6.0" },
  "devDependencies": {
    "@vendure/core": "workspace:*",
    "@vendure/common": "workspace:*",
    "@vendure/testing": "workspace:*"
  }
}
```

**规则**：`@vendure/core` / `@vendure/common` 必须放 `peerDependencies`（避免多份 core 实例导致 DI/TypeORM 元数据分裂），本地开发放 `devDependencies: workspace:*`。

### 步骤 3：`constants.ts`

```ts
export const loggerCtx = 'XxxPlugin';
export const XXX_PLUGIN_OPTIONS = Symbol('XXX_PLUGIN_OPTIONS');
```

`loggerCtx` 用于所有日志；Options 用 `Symbol` 而不是字符串 token，避免冲突。

### 步骤 4：`types.ts`

定义 `XxxPluginOptions` 与对外类型。枚举一律用**字符串字面量联合**而非 TS `enum`（数据库与 GraphQL 映射更简单）：

```ts
export type CouponType = 'FIXED' | 'PERCENT' | 'FULL' | 'FREE_SHIPPING';
```

### 步骤 5：实体

```ts
@Entity()
export class XxxRecord extends VendureEntity {
    constructor(input?: DeepPartial<XxxRecord>) { super(input); }

    @Column() name: string;

    @Column({ type: 'int', default: 0 }) count: number;

    @ManyToOne(type => Customer, { onDelete: 'CASCADE' }) customer: Customer;

    @Column({ type: 'simple-json', nullable: true }) payload: Record<string, any> | null;
}
```

要点：
- 必须 `extends VendureEntity`（自动带 `id` / `createdAt` / `updatedAt`，并遵循 ID 策略）。
- 表名默认类名蛇形；需要显式命名时用 `@Entity('xxx_record')`。
- **不要用数据库 `enum` 类型**（迁移时 PostgreSQL/MySQL 差异大）；用 `varchar` 存字符串字面量。
- JSON 用 `simple-json`，跨库兼容。
- 所有插件实体在 `@VendurePlugin({ entities: [...] })` 中登记，Vendure 会自动加入 TypeORM。

### 步骤 6：Service

```ts
@Injectable()
export class XxxService {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
        @Inject(XXX_PLUGIN_OPTIONS) private options: XxxPluginOptions,
    ) {}

    async create(ctx: RequestContext, input: CreateXxxInput): Promise<XxxRecord> {
        const repo = this.connection.getRepository(ctx, XxxRecord);
        const entity = new XxxRecord(input);
        return repo.save(entity);
    }
}
```

规范：
- 所有公开方法**第一个参数必须是 `ctx: RequestContext`**（渠道/语言/权限/事务都挂在上面）。
- 取仓储用 `this.connection.getRepository(ctx, Entity)`，**不要**用 `getRepository(Entity)`（会丢事务与渠道）。
- 需要跨方法事务时用 `@Transaction('auto')`（默认）或 `@Transaction('manual')` + `ctx.transactionalEntityManager`。
- 事件用 `this.eventBus.publish(new XxxEvent(ctx, entity))`。
- 日志用 `Logger.info('...', loggerCtx)` / `Logger.error(...)`。

### 步骤 7：Resolver

```ts
@Resolver()
export class XxxShopResolver {
    constructor(private xxxService: XxxService) {}

    @Query()
    @Allow(Permission.Public)
    async myXxxList(@Ctx() ctx: RequestContext, @Args() args: QueryXxxArgs) {
        return this.xxxService.findAll(ctx, args.options);
    }

    @Mutation()
    @Transaction()
    async createMyXxx(@Ctx() ctx: RequestContext, @Args() args: MutationCreateMyXxxArgs) {
        return this.xxxService.create(ctx, args.input);
    }
}
```

规范：
- 权限用 `@Allow(...)`，多个权限之间是 **OR**；匿名接口用 `Permission.Public`，仅本人数据用 `Permission.Owner`。
- 需要事务的 mutation 加 `@Transaction()`。
- `@Ctx()` 必填，**永远不要**从 `req` 手工构造 `RequestContext`。
- `@Relations({ relations: [...] })` 控制关联加载，避免 N+1。

### 步骤 8：GraphQL 扩展

在 `plugin.ts` 内用 `gql` 定义 SDL：

```ts
const shopApiExtensions = gql`
    extend type Query {
        myXxx(id: ID!): Xxx
    }
    extend type Mutation {
        createMyXxx(input: CreateMyXxxInput!): Xxx!
    }
    type Xxx implements Node { id: ID! name: String! }
`;
```

规则：
- **只用 `extend type Query/Mutation`**，不要重定义 `type Query`。
- schema 按 **Shop / Admin 分开**：`shopApiExtensions` / `adminApiExtensions`。
- SDL 与 resolver 一一对应；新增字段要同步 Dashboard 的 gql.tada codegen。

### 步骤 9：`plugin.ts`

```ts
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [XxxService],
    entities: [XxxRecord],
    shopApiExtensions: { schema: shopApiExtensions, resolvers: [XxxShopResolver] },
    adminApiExtensions: { schema: adminApiExtensions, resolvers: [XxxAdminResolver] },
    compatibility: '^3.6.0',
    configuration: config => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, [
            { name: 'xxxFlag', type: 'boolean', defaultValue: false },
        ]);
        return config;
    },
})
export class XxxPlugin {}
```

要点：
- `imports: [PluginCommonModule]` 几乎是必需的 —— 它提供 `TransactionalConnection`、`EventBus`、`ConfigService` 等核心 provider。
- `configuration()` 可能被**多次调用**（`preBootstrapConfig` 会重复跑），因此 customFields 必须**幂等合并**：

```ts
function mergeCustomFields<T extends { name: string }>(
    existing: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existing ?? []).map(f => f.name));
    return [...(existing ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}
```

- 静态 `init(options)` 模式（需要选项时）：

```ts
static init(options: XxxPluginOptions): Type<XxxPlugin> {
    this.options = options;
    return XxxPlugin;
}
// 并在 providers 中用 { provide: XXX_PLUGIN_OPTIONS, useFactory: () => XxxPlugin.options }
```

- `compatibility` 写 semver 范围，Vendure 启动时校验 core 版本。
- 提供 Dashboard 扩展时加 `dashboard: './dashboard/index.tsx'`。

### 步骤 10：装配与构建

四处同步（缺一处就会「代码写了但没生效」）：

1. `packages/dev-server/dev-config.ts` — `import { XxxPlugin }` + 加入 `plugins: [...]`（注意顺序）；
2. `packages/dev-server/package.json` — `"@vendure/xxx-plugin": "0.0.1"`；
3. `build-prod.ps1` — 加入 `$bizPkgs`；
4. `deploy-pack.js` — 加入 `PLUGINS`。

然后：

```bash
cd packages/xxx-plugin && bun run build
# 或根目录 bun run watch
cd packages/dev-server && bun run dev
```

---

## 2. CustomFields 规范

| 要点 | 说明 |
| --- | --- |
| 声明位置 | `configuration(config)` 中写 `config.customFields.<Entity>` |
| 幂等 | 必须去重合并（见上），因为 `configuration()` 可能多次执行 |
| 类型 | `string` / `int` / `float` / `boolean` / `datetime` / `text` / `localeString` / `struct` / `relation` |
| 公开性 | `public: true` 才会出现在 Shop API；否则仅 Admin |
| 可空 | `nullable: true`，否则 create 时必须有值 |
| 默认值 | `defaultValue`，注意 create 时由 `CustomFieldProcessingInterceptor` 应用；**update 不应用默认值** |
| 列表 | `list: true` 存数组 |
| 关系 | `type: 'relation'` + `entity: Product` + `eager`/`internal` 按需 |
| 迁移 | 已有表加列必须写 migration；SQLite 不支持部分 ALTER，需重建表策略 |

后端可编辑文案建议用 `localeString` + `localizeText()`（回退链：当前 locale → en → 首个值）。

---

## 3. 事务与 `RequestContext`

| 场景 | 做法 |
| --- | --- |
| 单个 service 方法内多次写 | `@Transaction()`（默认 `'auto'`） |
| 需要手工控制边界 | `@Transaction('manual')` + `ctx.transactionalEntityManager` |
| 跨 service 调用 | 传同一个 `ctx`，不要新建 |
| 后台任务 / Worker | `RequestContextService.create({ apiType: 'admin' })` 或 `createFromChannel` |
| 内部服务调用（无 HTTP） | `ctx = RequestContext.deserialize(serializedCtx)` 或 `create()` |

**禁止**：在 service 里直接 `new RequestContext(...)`（会丢 channel、language、权限）；用 `RequestContextService`。

---

## 4. 错误处理

```ts
import { EntityNotFoundError, UserInputError, InternalServerError } from '@vendure/core';

throw new UserInputError('COUPON_ALREADY_CLAIMED');           // 用户输入错误 → 400
throw new EntityNotFoundError('CouponTemplate', id);          // 404
throw new InternalServerError('SETTLEMENT_FAILED');           // 500
```

规则：
- 错误码用 **UPPER_SNAKE_CASE**，作为 `message` 传入；`TranslateErrorResultInterceptor` 会在响应里补 `message`/`errorCode`。
- 自定义业务错误继承 `I18nError` 并注册翻译键，避免把中文硬编码进 message。
- GraphQL 侧返回 `ErrorResult` 联合（如 `InsufficientStockError`），不要靠抛异常传业务失败。
- HTTP 映射见 [04-api-layer.md](./04-api-layer.md#7-错误体系)。

---

## 5. 日志

```ts
import { Logger } from '@vendure/core';
import { loggerCtx } from './constants';

Logger.info(`settled order ${order.code}`, loggerCtx);
Logger.warn('...', loggerCtx);
Logger.error(`failed: ${e.message}`, loggerCtx, e.stack);
Logger.verbose('...', loggerCtx);   // 仅 verbose 级别
```

**不要**用 `console.log`。日志级别由 `config.logger` 控制；`DefaultLogger` 在生产输出 JSON 友好格式。

---

## 6. 事件与任务

### 6.1 订阅事件

```ts
@Injectable()
export class XxxSubscriber implements OnApplicationBootstrap {
    constructor(private eventBus: EventBus) {}

    onApplicationBootstrap() {
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async event => {
            await this.handle(event.ctx, event.order);
        });
    }
}
```

常用事件：`OrderStateTransitionEvent`、`OrderPlacedEvent`、`PaymentStateTransitionEvent`、`RefundStateTransitionEvent`、`FulfillmentStateTransitionEvent`、`ProductEvent`、`CustomerEvent`、`LoginEvent`、`LogoutEvent`、`ChannelEvent`、`AssetEvent`、`StockMovementEvent`、`PluginWithConfigurationEvent`。

注意：worker 与 server 都会跑 `onApplicationBootstrap`，需要判断 `ProcessContext.isWorker` 避免重复处理。

### 6.2 定义任务

```ts
@Injectable()
export class XxxJobService {
    constructor(private jobQueueService: JobQueueService) {}

    async onApplicationBootstrap() {
        this.queue = await this.jobQueueService.createQueue({
            name: 'xxx',
            process: async job => { /* ... */ },
        });
    }

    addJob(data: any) { this.queue.add(data); }
}
```

并发与重试由 `JobQueueStrategy` 控制；默认 `DefaultJobQueuePlugin`（DB 队列）。

### 6.3 定时任务

```ts
this.schedulerRegistry.addCronJob('xxx-expire', '0 3 * * *', handler);
```

**只在 server 进程注册**（`ProcessContext.isWorker` 时跳过），否则双进程重复执行。

---

## 7. 命名与文件规范

| 对象 | 约定 | 示例 |
| --- | --- | --- |
| 包名 | `@vendure/<domain>-plugin` | `coupon-plugin` |
| 类 | PascalCase + 后缀 | `CouponService`、`CouponShopResolver`、`CouponTemplate` |
| 文件 | kebab-case + 后缀 | `coupon-sale.service.ts` |
| 插件类 | `XxxPlugin` | `CouponPlugin` |
| loggerCtx | 插件名 | `'CouponPlugin'` |
| Options Symbol | `XXX_PLUGIN_OPTIONS` | `COUPON_PLUGIN_OPTIONS` |
| GraphQL 类型 | PascalCase | `CouponTemplate` |
| GraphQL 字段 | camelCase | `minSpend` |
| 错误码 | UPPER_SNAKE | `COUPON_NOT_OWNED` |
| 数据库表 | 蛇形 | `coupon_template` |
| 迁移类 | 动词 + 对象 + 日期 | `AddCouponIndexes20260919` |

导出顺序：`plugin` → `types` → `constants` → `entities` → `services`。

---

## 8. 多租户与多语言（本仓库强制）

- 所有查询必须**按 `ctx.channelId` 过滤**（或显式支持跨渠道）；不要写「查全表」。
- 新实体若属渠道私有，加 `@Column() channelId: ID` 或 `@ManyToOne(() => Channel)`，并在 service 里强制带上。
- 面向 C 端的接口必须接受 `languageCode`（由 `RequestContext` 提供），文案用 `localeString` + `localizeText()`。
- 租户敏感配置（支付密钥等）**不要**放 `.env`，走 `SettingsStore` 或渠道 customFields（AES-256-GCM 加密）。
- 渠道请求头固定 `vendure-token`，不要自定义名字（否则多店切换失效）。

详见 [06-business-domains.md](./06-business-domains.md) 与 [03-data-model.md](./03-data-model.md)。

---

## 9. 迁移（Migration）

1. 改实体；
2. 生成迁移（`typeorm migration:generate` 或手写）；
3. 放到 `src/migrations/`，用类导出；
4. 在 `plugin.ts` 的 `@VendurePlugin({ migrations: [...] })` 登记；
5. 跑 `runMigrations`（dev-server 启动时自动）。

规则：
- 迁移必须**同时兼容 PostgreSQL 与 SQLite**（开发/测试常用 sqljs）。SQLite 不支持 `ALTER COLUMN`、`DROP COLUMN`（旧版），需要"建新表 → 拷数据 → 换名"三段式。
- 加索引用 `CREATE INDEX IF NOT EXISTS`（PG 支持，SQLite 也支持）。
- 在 e2e 中加迁移测试时，务必覆盖「旧库升级」路径。

---

## 10. 测试

| 类型 | 位置 | 命令 |
| --- | --- | --- |
| 单测 | `src/*.spec.ts` | `bun run test` |
| e2e | `e2e/*.e2e-spec.ts` | `bun run e2e` |
| Dashboard e2e | `packages/dashboard/e2e/tests/` | 见 [09-testing.md](./09-testing.md) |

新插件至少要有：
1. 核心 service 的单测（构造输入 → 断言输出/异常）；
2. 一个端到端流程 e2e（GraphQL 调用 → 断言状态机变化）；
3. 若涉及渠道隔离，补一个「其他渠道不可见」的用例。

---

## 11. 提交与分支规范

### 11.1 Commit

遵循 Conventional Commits（`commitlint` 已配置，`subject-case: sentence-case`）：

```
feat(coupon): 支持分享裂变发券
fix(order): 修复拆单后金额为 0
refactor(core): 提取 RequestContext 创建逻辑
docs(wiki): 补充部署说明
```

- 修复 issue 时在 body 写 `Fixes #1234`；仅相关写 `Relates to #1234`。
- 多行 message 用 `git commit -F <file>`，Windows PowerShell 下用
  `[IO.File]::WriteAllText($path, $msg, [Text.UTF8Encoding]::new($false))` 避免 BOM。

### 11.2 分支

| 分支 | 用途 | PR 目标 |
| --- | --- | --- |
| `master` | bug fix | 默认 |
| `minor` | 新功能 | — |
| `major` | 破坏性变更 | — |

### 11.3 提交前钩子

`husky` + `lint-staged`：`pre-commit` 跑 ESLint/Prettier，`commit-msg` 跑 commitlint。**不要**用 `--no-verify` 绕过。

---

## 12. 常见陷阱清单

| 陷阱 | 后果 | 正确做法 |
| --- | --- | --- |
| `getRepository(Entity)` 不带 ctx | 丢事务与渠道过滤 | `connection.getRepository(ctx, Entity)` |
| `configuration()` 里直接 push customFields | 重复启动产生重复字段 | 幂等 `mergeCustomFields` |
| 只用 `extend type Query`? 否 —— 用 `type Query` | schema 合并失败 | 必须 `extend type Query` |
| 在 service 新建 `RequestContext` | 丢 channel/语言/权限 | 从上游透传 `ctx` |
| 用 TS `enum` 存数据库 | 迁移/跨库兼容差 | 字符串字面量联合 + `varchar` |
| 定时任务不判断 worker | 双进程重复执行 | `ProcessContext.isWorker` 跳过 |
| 忘记同步四处装配 | 插件「写了但没跑」 | dev-config / dev-server package.json / build-prod.ps1 / deploy-pack.js |
| 改了实体不删 `e2e/__data__` | 旧库跑新代码 | 删除缓存重跑 |
| Dashboard 硬编码 `http://localhost` | 生产连不上 API | `api.host/port: 'auto'` |
| 自定义字段放 `e2e-vendure-config.ts` | 商品创建 mutation 失败 | 只放 `global-setup.ts` |
| `docs`/产物目录被 `.gitignore` | 服务器 `Cannot find module` | 保持 `dist`/`lib` 未被忽略 |

---

## 13. 代码索引

| 主题 | 位置 |
| --- | --- |
| 插件装饰器 | [packages/core/src/plugin/vendure-plugin.ts](../../packages/core/src/plugin/vendure-plugin.ts) |
| 插件元数据 | [packages/core/src/plugin/plugin-metadata.ts](../../packages/core/src/plugin/plugin-metadata.ts) |
| 事务 | [transaction.decorator.ts](../../packages/core/src/api/decorators/transaction.decorator.ts) |
| 错误类型 | [packages/core/src/common/error/errors.ts](../../packages/core/src/common/error/errors.ts) |
| 权限枚举 | [permission-definition.ts](../../packages/core/src/common/permission-definition.ts) |
| 事件定义 | [packages/core/src/event-bus/events/](../../packages/core/src/event-bus/events/) |
| 参考实现 | [packages/coupon-plugin](../../packages/coupon-plugin) |
| 装配清单 | [packages/dev-server/dev-config.ts](../../packages/dev-server/dev-config.ts) |
| 仓库规范 | [AGENTS.md](../../AGENTS.md)、[CONTRIBUTING.md](../../CONTRIBUTING.md) |

---

## 14. 要点回顾

1. 一切新能力 = 新插件包，不动 core。
2. `@VendurePlugin` 的 `imports` 里几乎总要 `PluginCommonModule`。
3. service 第一个参数永远是 `ctx`，仓储永远走 `connection.getRepository(ctx, E)`。
4. customFields 必须幂等合并。
5. 只在 `extend type Query/Mutation` 上扩展 schema。
6. 实体继承 `VendureEntity`，JSON 用 `simple-json`，避免数据库 enum。
7. 新插件要同步四处装配，否则不生效。
8. 多租户按 `channelId` 过滤，多语言走 `languageCode` + `localeString`。
9. 迁移必须兼容 PostgreSQL + SQLite。
10. 提交走 Conventional Commits + issue 引用，不绕过钩子。
