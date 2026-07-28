# 库存模块验收记录

- 日期：2026-07-28
- 模块：inventory-plugin
- 验收人：开发者自测
- 实施计划：`packages/dev-server/docs/superpowers/plans/2026-07-28-inventory-module-implementation.md`
- 关联提交：`0a549f96b` (test + entity fix)

## 1. 验收范围

Task 23-25：
- Task 23：创建 `reset-inventory-pwd.js`（测试账号设置）
- Task 24：创建 `test-inventory-flow.js`（8 组 e2e 测试）+ 执行
- Task 25：最终验证 + 验收记录

## 2. 测试账号

| 账号 | 角色 | 密码 | 用途 |
|------|------|------|------|
| `superadmin@china.test` | SuperAdmin | superadmin | 全权限对照 |
| `inv1@zhao.test` | inventory-staff | a963963 | 库存操作主体 |
| `sales1@zhao.test` | sales-staff | a963963 | 权限隔离对照 |

账号通过 `reset-inventory-pwd.js` 创建/重置，inventory-staff 角色 ID=5。

## 3. e2e 测试结果（8/8 passed）

执行命令：`node test-inventory-flow.js`

| # | 测试组 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 角色权限同步 | ✓ | inventory-staff 包含 6 个权限：Authenticated, ViewStock, ManageStockIn/Out/Move, ManageStocktake, ManageProduct |
| 2 | 库存查询 | ✓ | stockLevels 返回 19 条，stockLocations 返回 4 个仓库 |
| 3 | StockIn 流程 | ✓ | create → complete (stock +10) → 二次 complete 报 Invalid state [RKT20260728205228322] |
| 4 | StockOut 流程 | ✓ | 库存不足（99999）报 Insufficient stock → 库存充足完成 (stock -5) [CKT20260728205228130] |
| 5 | StockMove 流程 | ✓ | create → ship → receive → complete + 非法转换（Pending→Received）报 Invalid state [DBT20260728205228019] |
| 6 | StockMove 回滚 | ✓ | ship (-2) → cancel (+2 恢复) [DBT20260728205228757] |
| 7 | Stocktake 流程 | ✓ | create → startCounting → submitCount → reconcileLine → complete (stock +1 差异调整) [PDT20260728205228977] |
| 8 | 权限隔离 | ✓ | inventory-staff 被挡在 salesCreateOrder 之外，sales-staff 被挡在 createStockInOrder 之外 |

## 4. StockMovement.businessReason 审计追踪

直查 PostgreSQL `stock_movement` 表，确认 7 条 ADJUSTMENT 记录均写入 `customFieldsBusinessreason`：

| 业务单据 | 变化 | reason |
|----------|------|--------|
| StockInOrder RKT20260728205228322 | +10 | `StockInOrder#RKT...:inbound` |
| StockOutOrder CKT20260728205228130 | -5 | `StockOutOrder#CKT...:outbound` |
| StockMoveOrder DBT20260728205228019 (源仓) | -3 | `StockMoveOrder#DBT...:source-out` |
| StockMoveOrder DBT20260728205228019 (目标仓) | +3 | `StockMoveOrder#DBT...:target-in` |
| StockMoveOrder DBT20260728205228757 (发货) | -2 | `StockMoveOrder#DBT...:source-out` |
| StockMoveOrder DBT20260728205228757 (取消回滚) | +2 | `StockMoveOrder#DBT...:rollback-source` |
| StocktakeOrder PDT20260728205228977 (盘点差异) | +1 | `StocktakeOrder#PDT...:reconcile` |

## 5. 修复的问题

### 5.1 DataTypeNotSupportedError
- 原因：实体 ID 字段（productVariantId, orderId, targetLocationId 等）使用 `@Column()` 装饰器，TypeScript 反射为 `Object` 类型，PostgreSQL 不支持
- 修复：改用 Vendure `@EntityId()` 装饰器（与核心 StockLevel 实体一致）

### 5.2 订单行未持久化（cascade 缺失）
- 原因：`@OneToMany` 关系未配置 `cascade: true`，`repo.save(order)` 不保存关联的 lines
- 表现：订单创建后 lines 为空数组 → 库存调整循环不执行 → StockIn/Out 无库存变化，StockOut 不校验库存不足
- 修复：四个订单实体的 `@OneToMany` 添加 `{ cascade: true }`

### 5.3 unitPrice 联合类型反射问题
- 原因：`unitPrice: number | null` 联合类型反射为 `Object`，PostgreSQL 不支持
- 修复：显式指定 `@Column({ type: 'int', nullable: true })`

## 6. 非阻塞性改进建议

1. `RoleSyncService.syncRoles()` 应自动为所有角色补绑 `Authenticated` 基础权限，而非依赖 constants.ts 手动声明
2. 前端 vadmin 库存模块页面未做端到端验证（本次仅验收后端 API）
3. `stockLocations` 核心查询需要 `ReadSettings` 权限，inventory-staff 角色未包含，前端需用自定义查询或在角色中追加权限

## 7. 验收结论

库存模块后端功能验收通过，8/8 e2e 测试全部通过，StockMovement.businessReason 审计追踪正常。
