# 02 · 核心模块与关键类

> 目录：`packages/core/src`
> 本文按模块说明职责、关键类、关键方法，以及业务插件最常用的扩展点。

---

## 1. 模块总表

| 模块 | 目录 | 职责 |
|---|---|---|
| bootstrap | `bootstrap.ts` | 启动 server/worker，预处理配置 |
| config | `config/` | 配置定义、默认值、合并、`ConfigService` |
| connection | `connection/` | TypeORM DataSource、`TransactionalConnection`、事务 |
| entity | `entity/` | 核心实体与 subscribers |
| service | `service/` | 领域服务 + 通用 helpers |
| api | `api/` | GraphQL schema/resolvers、中间件、装饰器 |
| plugin | `plugin/` | `@VendurePlugin`、插件元数据、插件模块 |
| event-bus | `event-bus/` | 领域事件发布/订阅 |
| job-queue | `job-queue/` | 任务队列抽象与内存实现 |
| scheduler | `scheduler/` | 定时任务注册与执行 |
| worker | `worker/` | Worker 应用与健康检查 |
| cache | `cache/` | 请求级/全局缓存 |
| i18n | `i18n/` | 服务端国际化与错误翻译 |
| health-check | `health-check/` | 健康检查策略与 HTTP 端点 |
| data-import | `data-import/` | 导入导出 |
| migration-utils | `migration-utils/` | 迁移辅助 |
| process-context | `process-context/` | server/worker 进程标识 |
| settings-store | `service/helpers/settings-store/` | 3.6 的设置存储（全局/用户/渠道作用域） |
| telemetry | `telemetry/` | OpenTelemetry 接入点 |
| testing | `testing/` | 核心测试辅助（测试用 App/服务） |

---

## 2. config：配置系统

### 关键类

| 类/文件 | 说明 |
|---|---|
| `VendureConfig` / `RuntimeVendureConfig`（`config/vendure-config.ts`） | 用户配置接口 / 运行时必填配置 |
| `defaultConfig`（`config/default-config.ts`） | 默认 API 路径、端口、CORS、鉴权、缓存等 |
| `ConfigService`（`config/config.service.ts`） | 全局配置访问器，提供 `apiOptions`、`authOptions`、`entityOptions` 等只读视图与 `getCustomFieldsForAllEntities()`、`toJSON()` |
| `setConfig()` / `getConfig()`（`config/config-helpers.ts`） | 全局配置单例的写入/读取 |
| `mergeConfig()`（`config/merge-config.ts`） | 深度合并默认配置与用户配置 |
| `runPluginConfigurations()`（`config/plugin-configurations.ts`） | 按 plugins 顺序执行 `configuration()` |

### 要点

- `ConfigService` 是请求无关的全局单例，**不要**在服务里保存请求级状态。
- 插件修改配置只能通过 `configuration: config => { ...; return config; }`，不要直接改 `defaultConfig`。
- 运行时配置在 `preBootstrapConfig()` 后冻结为 `RuntimeVendureConfig`，启动后不再变化。

---

## 3. connection：事务与数据访问

### `TransactionalConnection`

文件：`packages/core/src/connection/transactional-connection.ts`

| 方法 | 作用 |
|---|---|
| `getRepository(ctx, entity)` | 获取绑定当前请求事务的 Repository（最常用） |
| `withTransaction(ctx, work)` | 在事务中执行回调 |
| `startTransaction(ctx)` / `commitOpenTransaction(ctx)` / `rollBackTransaction(ctx)` | 手动事务 |
| `getEntityOrThrow(ctx, entity, id, options)` | 按 ID 取实体，不存在抛错，可带 channel/relations |
| `findOneInChannel(ctx, entity, id, channelId, options)` | 渠道内查找 |
| `findByIdsInChannel(...)` | 渠道内批量查找 |
| `wrapWithAccessControl(...)` | 包装渠道/权限过滤 |
| `getTransactionManager(ctx)` | 获取 TypeORM EntityManager |

**开发规则**

```ts
// ✅ 正确：始终透传 ctx
const repo = this.connection.getRepository(ctx, Product);
const product = await repo.findOne({ where: { id } });

// ❌ 错误：绕过 RequestContext，可能拿到事务外连接
const repo = this.dataSource.getRepository(Product);
```

### 事务装饰器

文件：`packages/core/src/api/decorators/transaction.decorator.ts`

```ts
@Transaction()                 // auto：成功提交、异常回滚
@Transaction('manual')         // 手动控制提交点
@Transaction('auto', 'SERIALIZABLE')
```

事务 QueryRunner 挂在 `RequestContext` 上，由 `TransactionInterceptor` 创建/提交/回滚。

---

## 4. service：服务层

### 4.1 核心服务（`service/service.module.ts`）

| 分组 | 服务 | 主要职责 |
|---|---|---|
| 商品目录 | `ProductService` | 商品 CRUD、渠道分配、选项组、slug |
| | `ProductVariantService` | 变体 CRUD、价格、库存、渠道 |
| | `CollectionService` | 分类树、过滤器、面包屑、商品集合 |
| | `FacetService` / `FacetValueService` | 面值/分面 |
| | `ProductOptionGroupService` / `ProductOptionService` | 选项与选项组 |
| | `AssetService` | 资源上传、预览、关联、渠道 |
| | `TagService` | 标签 |
| 订单 | `OrderService` | 订单全生命周期、状态机、支付/履约/退款、改单、合并 |
| | `OrderTestingService` | 订单测试辅助（测试环境） |
| | `PaymentService` / `PaymentMethodService` | 支付创建、状态流转、退款、支付方式 |
| | `FulfillmentService` | 履约单创建与状态 |
| | `ShippingMethodService` | 配送方式与计算器/资格检查器 |
| | `StockLevelService` / `StockLocationService` / `StockMovementService` | 库存、库位、库存移动 |
| 客户 | `CustomerService` | 客户注册、地址、验证、密码重置 |
| | `CustomerGroupService` | 客户分组 |
| 渠道/权限 | `ChannelService` | 渠道 CRUD、token 解析、默认渠道、渠道感知 |
| | `RoleService` / `AdministratorService` / `ApiKeyService` / `UserService` | 角色、管理员、API Key、用户 |
| | `AuthService` / `SessionService` | 登录、会话、认证策略 |
| | `SellerService` | 官方 Seller（本仓库实际少用） |
| 营销 | `PromotionService` | 促销条件/动作、优惠券码、使用次数 |
| 区域/税 | `ZoneService` / `CountryService` / `TaxCategoryService` / `TaxRateService` | 区域、国家、税类、税率 |
| 系统 | `GlobalSettingsService` | 全局设置（自定义字段） |
| | `HistoryService` | 变更历史 |
| | `SearchService` | 搜索索引适配（配合搜索插件） |
| | `InitializerService` | 首次初始化默认数据/超级管理员 |

### 4.2 通用 Helpers（`service/service.module.ts`）

| Helper | 作用 |
|---|---|
| `OrderCalculator` | 订单价格、折扣、运费、税的计算 |
| `OrderModifier` | 改单（加/减/改数量、改配送、退款调整） |
| `OrderMerger` / `OrderSplitter` | 订单合并/拆分 |
| `OrderStateMachine` | 订单状态机定义与校验 |
| `PaymentStateMachine` / `FulfillmentStateMachine` / `RefundStateMachine` | 支付/履约/退款状态机 |
| `OrderCalculator` | 统一计算入口 |
| `ActiveOrderService` | 获取/创建当前活动订单 |
| `ConfigArgService` | 促销/配送/支付配置参数解析 |
| `CustomFieldRelationService` | 自定义字段关联实体处理 |
| `EntityHydrator` | 按 relations 深度加载实体 |
| `EntityDuplicatorService` | 实体复制 |
| `EntitySlugService` / `SlugService` / `SlugValidator` | slug 生成与校验 |
| `ExternalAuthenticationService` | 第三方登录用户创建/绑定 |
| `FacetValueChecker` | 促销条件中的分面匹配 |
| `ListQueryBuilder` | 列表查询、分页、排序、过滤 |
| `LocaleStringHydrator` | 多语言字段按当前 locale 取值 |
| `PasswordCipher` | 密码哈希/校验 |
| `ProductPriceApplicator` | 把变体价格应用到订单行 |
| `RequestContextService` | 构造请求上下文 |
| `SettingsStoreService` | 设置存储 |
| `ShippingCalculator` | 运费计算 |
| `TranslatableSaver` | 翻译实体保存 |
| `TranslatorService` | 翻译查询 |
| `VerificationTokenGenerator` | 邮箱/手机验证 token |
| `OrderTestingService` | 测试订单辅助 |

### 4.3 最常用方法速查

#### `OrderService`（`service/services/order.service.ts`）

| 类别 | 方法 |
|---|---|
| 查询 | `findOne`、`findOneByCode`、`findAll`、`findByCustomerId`、`getActiveOrderForUser`、`getAggregateOrder`、`getSellerOrders` |
| 下单 | `create`、`createDraft`、`addItemToOrder`、`addItemsToOrder`、`adjustOrderLine`、`removeItemFromOrder`、`addSurchargeToOrder`、`applyCouponCode`、`removeCouponCode` |
| 地址/配送/支付 | `setShippingAddress`、`setBillingAddress`、`getEligibleShippingMethods`、`setShippingMethod`、`getEligiblePaymentMethods`、`addPaymentToOrder`、`addManualPaymentToOrder` |
| 状态 | `getNextOrderStates`、`transitionToState`、`transitionPaymentToState`、`transitionFulfillmentToState`、`transitionRefundToState` |
| 履约/退款 | `createFulfillment`、`cancelOrder`、`refundOrder`、`settleRefund` |
| 改单 | `modifyOrder`、`mergeOrders` |
| 校验 | `assertAddingItemsState`、`assertQuantityIsPositive`、`assertNotOverOrderItemsLimit` |

#### `OrderModifier`（`service/helpers/order-modifier/order-modifier.ts`）

`constrainQuantityToSaleable`、`getOrCreateOrderLine`、`updateOrderLineQuantity`、`modifyOrder`、`setShippingMethods`、`cancelOrderByOrderLines`、`calculateRefundAdjustment`。

#### `ProductService`

`findAll`、`findOne`、`findBySlug`（`findOneBySlug`）、`create`、`update`、`softDelete`、`assignProductsToChannel`、`removeProductsFromChannel`、`addOptionGroupToProduct`、`getProductWithOptionGroups`。

#### `PaymentService`

`create`、`findOneOrThrow`、`createPayment`、`settlePayment`、`cancelPayment`、`createManualPayment`、`createRefund`、`getPaymentRefundTotal`、`transitionToState`。

#### `FulfillmentService`

`create`、`getFulfillmentLines`、`transitionToState`、`getNextStates`。

#### `StockMovementService`

`adjustProductVariantStock`、`createAllocationsForOrder`、`createSalesForOrder`、`createCancellationsForOrderLines`、`createReleasesForOrderLines`、`createOutstandingReleasesForOrderLines`、`trackInventoryForVariant`。

#### `SearchService`

`adopt`（接管索引适配器）、`reindex`。

---

## 5. request-context：请求上下文

文件：`packages/core/src/service/helpers/request-context/request-context.service.ts`

| 方法 | 作用 |
|---|---|
| `create(options)` | 编程式创建（定时任务、系统任务常用） |
| `fromRequest(req, info, requiredPermissions)` | 从 GraphQL 请求构造 |
| `getChannelToken(req)` | 读取 `vendure-token` 查询参数或请求头 |
| `getLanguageCode(req, channel)` | `languageCode` 参数 → Channel 默认 → 全局默认 |
| `getCurrencyCode(req, channel)` | 币种解析 |
| `userHasRequiredPermissionsOnChannel(...)` | 权限判定 |

`RequestContext` 携带：`req`、`apiType`、`channel`、`languageCode`、`currencyCode`、`session`、`user`、`authorizedAsOwnerOnly`、`isAuthorized`、`transactionManager` 等。

---

## 6. event-bus：领域事件

文件：`packages/core/src/event-bus/event-bus.ts`

| 方法 | 作用 |
|---|---|
| `publish(event)` | 发布事件，先执行 blocking handlers，再通知订阅者 |
| `ofType(...types)` | 返回 RxJS Observable，按类型过滤 |
| `filter(predicate)` | 过滤事件流 |
| `registerBlockingEventHandler(handler, type)` | 注册阻塞处理器（在事务提交前执行） |
| `awaitActiveTransactions(event)` | 等待事件关联的活跃事务完成 |

内置事件（`event-bus/events/`，节选）：

- 生命周期：`BootstrappedEvent`、`InitializerEvent`
- 认证：`LoginEvent`、`LogoutEvent`、`AttemptedLoginEvent`、`IdentifierChangeEvent`、`PasswordResetEvent`
- 商品：`ProductEvent`、`ProductVariantEvent`、`ProductVariantPriceEvent`、`ProductChannelEvent`、`CollectionEvent`、`CollectionModificationEvent`、`FacetEvent`、`AssetEvent`
- 订单：`OrderEvent`、`OrderPlacedEvent`、`OrderStateTransitionEvent`、`OrderLineEvent`
- 支付/履约/退款：`PaymentStateTransitionEvent`、`FulfillmentEvent`、`FulfillmentStateTransitionEvent`、`RefundEvent`、`RefundStateTransitionEvent`
- 客户：`CustomerEvent`、`CustomerAddressEvent`、`CustomerGroupEvent`、`AccountRegistrationEvent`、`AccountVerifiedEvent`
- 系统：`ChannelEvent`、`ChangeChannelEvent`、`RoleEvent`、`AdministratorEvent`、`GlobalSettingsEvent`、`HistoryEntryEvent`、`StockMovementEvent`、`SearchEvent`

**使用建议**：插件监听事件优先用 `EventBus.ofType(...).subscribe(...)`；需要「事务内、失败即回滚」的副作用用 blocking handler；耗时副作用（发消息、同步第三方）交给 JobQueue。

---

## 7. job-queue：任务队列

文件：`packages/core/src/job-queue/job-queue.service.ts`

| 方法 | 作用 |
|---|---|
| `start()` | 启动队列监听（Worker 由 `VendureWorker.startJobQueue()` 调用） |
| `addBuffer(buffer)` / `removeBuffer(buffer)` | 注册/移除任务缓冲 |
| `bufferSize()` / `flush()` | 缓冲统计与刷新 |
| `getJobQueues()` | 获取所有队列 |
| `shouldStartQueue()` | 当前进程是否应启动队列 |

相关类型：`Job`、`JobQueueStrategy`、`JobBuffer`、`JobQueueOptions`。官方可选插件 `BullMQJobQueuePlugin`（Redis）在 `packages/job-queue-plugin`，本仓库 dev-config 默认使用 `DefaultJobQueuePlugin`（数据库队列）。

---

## 8. scheduler：计划任务

文件：`packages/core/src/scheduler/scheduler.service.ts`

| 方法 | 作用 |
|---|---|
| `onApplicationBootstrap()` | 启动时注册所有 `ScheduledTask` |
| `getTaskList()` | 列出任务及下次执行时间 |
| `updateTask(taskId, updates)` | 修改任务配置 |
| `runTask(taskId)` | 立即执行 |
| `createTaskInfo()` / `createCronJob()` | 任务元信息与 cron 实例 |

核心任务示例：

- `cleanSessionsTask`：清理过期会话
- `cleanOrphanedSettingsStoreTask`：清理孤儿设置
- 插件任务：`releaseExpiredHotelHoldsTask`、`hotelBookingDailyTransitionTask`、售后超时、订单超时补偿等

`SchedulerOptions.runTasksInWorkerOnly` 决定计划任务只在 Worker 跑还是当前进程跑。

---

## 9. worker：Worker 应用

目录：`packages/core/src/worker/`

| 文件 | 说明 |
|---|---|
| `worker.module.ts` | Worker 的 Nest 模块图 |
| `vendure-worker.ts` | `VendureWorker` 包装类，暴露 `startJobQueue()` |
| `worker-health.service.ts` | Worker 健康检查 |

Worker 不监听 HTTP，通常用于：
- 消费 JobQueue
- 执行 Scheduler 任务
- 处理重计算/第三方同步

---

## 10. cache：缓存

文件：`packages/core/src/cache/cache.service.ts`

| 方法 | 作用 |
|---|---|
| `createCache(config)` | 创建带 TTL 的缓存对象 |
| `delete(key)` | 删除单个键 |
| `invalidateTags(tags)` | 按标签失效 |

缓存对象常用 API：`get`、`set`、`delete`、`invalidateTags`、`getMany/setMany`。

`cache/` 下还有 `CacheStrategy` 定义（内存缓存、Redis 缓存的扩展点）。

---

## 11. i18n：服务端国际化

目录：`packages/core/src/i18n/`

| 文件/类 | 说明 |
|---|---|
| `i18n.service.ts` | i18next 初始化、`handle()` 中间件、错误翻译 |
| `i18n-error.ts` | `I18nError`，携带 message key 与变量 |
| `messages/` | 核心错误消息资源 |

要点：
- HTTP 头/查询参数决定请求语言（见 RequestContext）。
- `I18nError` 会被 `TranslateErrorResultInterceptor` 翻译后返回 GraphQL。
- 业务插件自定义错误建议继承 `I18nError` 或在插件内维护消息。

---

## 12. health-check：健康检查

目录：`packages/core/src/health-check/`

| 类 | 说明 |
|---|---|
| `HealthCheckRegistryService` | 注册/执行健康检查策略 |
| `HealthCheckController` | HTTP 端点 |
| `TypeOrmHealthCheckStrategy` | 数据库连通性 |
| `HttpHealthCheckStrategy` | 外部 HTTP 依赖 |

插件可实现 `HealthCheckStrategy` 把第三方依赖（Redis、Meilisearch、支付网关）纳入健康检查。

---

## 13. data-import 与 migration

| 能力 | 文件 | 说明 |
|---|---|---|
| 导入导出 | `packages/core/src/data-import/` | 商品/客户等批量导入，`ImportExportOptions` 配置资源目录 |
| 迁移执行 | `packages/core/src/migrate.ts` | `runMigrations()`、`generateMigration()`、`revertLastMigration()` |
| 迁移工具 | `packages/core/src/migration-utils/` | 生成迁移辅助 |

本仓库 dev-server 启动时先 `runMigrations(devConfig)`；生产是否自动同步取决于 `synchronize` / `DB_SYNC`。

---

## 14. settings-store：设置存储（3.6）

文件：`packages/core/src/service/helpers/settings-store/settings-store.service.ts`

| 方法 | 作用 |
|---|---|
| `register(definition)` | 注册设置字段 |
| `getMany(ctx, keys)` / `setMany(ctx, entries)` | 批量读写 |
| `getFieldDefinition(key)` / `getAllFieldDefinitions()` | 字段元数据 |
| `cleanupOrphanedEntries()` | 清理无定义的孤儿设置 |
| `isReadonly` / `hasPermission` | 权限与只读控制 |

作用域：`global`、`channel`、`user`（`SettingsStoreScopes`）。Dashboard 用它保存用户视图、全局视图。

---

## 15. process-context

文件：`packages/core/src/process-context/process-context.ts`

- `setProcessContext('server' | 'worker')`
- `ProcessContext.isWorker` / `isServer`

插件常用它决定是否注册静态资源、定时任务、HTTP Controller。

---

## 16. 扩展点速查（业务插件最常接触）

| 想做什么 | 用哪个扩展点 |
|---|---|
| 新增数据表 | `@VendurePlugin({ entities: [...] })` |
| 新增 GraphQL 查询/变更 | `shopApiExtensions` / `adminApiExtensions` |
| 修改订单价格 | `OrderItemPriceCalculationStrategy` / `OrderLinePriceCalculationStrategy` |
| 修改运费 | `ShippingCalculator` / `ShippingEligibilityChecker` |
| 新增支付方式 | `PaymentMethodHandler` |
| 新增履约方式 | `FulfillmentHandler` |
| 新增促销条件/动作 | `PromotionCondition` / `PromotionAction` |
| 修改订单流程 | `OrderProcess` / `OrderStateTransitionStrategy` |
| 监听业务事件 | `EventBus.ofType()` |
| 延迟/异步任务 | `JobQueueService` / `ScheduledTask` |
| 定时任务 | `schedulerOptions.tasks` |
| 多语言 | `TranslatorService` / `LocaleStringHydrator` |
| 自定义权限 | `authOptions.customPermissions` + `@Allow` |
| 后台页面扩展 | `dashboard` 元数据 / Dashboard 插件扩展 API |
