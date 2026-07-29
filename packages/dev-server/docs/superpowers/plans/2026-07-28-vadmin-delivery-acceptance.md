# Vadmin Delivery Plugin 验收通过记录

- 日期：2026-07-28
- 验收脚本：`e:\code\vendure\test-delivery-flow.js`
- 结果：**全部通过（27/27）**

## 验收范围

| 模块 | 验收项 | 结果 |
|------|--------|------|
| 权限同步 | `delivery-staff` 角色包含 `Authenticated` 基础权限 | ✓ |
| 账号管理 | `delivery1` (id=4, userId=8) 创建并绑定 `delivery-staff` 角色 | ✓ |
| 鉴权 | `delivery1` 用 emailAddress 登录成功 | ✓ |
| myPermissions | 返回 roles / permissions / visibleModules | ✓ |
| myDeliveries | 送货员可查询自己的送货任务 | ✓ |
| 自动派单 | 订单 PaymentSettled 后异步派单到候选送货员 | ✓ |
| 全流程 | startDelivery: assigned → in_progress | ✓ |
| 全流程 | markDelivered: in_progress → delivered | ✓ |
| 权限控制 | 未登录访问 myDeliveries 被拒绝 | ✓ |

## 关键修复

1. **所有角色补充 `Authenticated` 权限**
   - 文件：`packages/delivery-plugin/src/constants.ts`
   - 问题：`ROLE_PERMISSIONS_MAP` 中所有角色都缺少 `Authenticated` 基础权限，导致送货员调用 `myPermissions` 时返回 `FORBIDDEN`
   - 修复：为 `delivery-staff`、`sales-staff`、`inventory-staff`、`customer-service`、`operations-staff`、`manager`、`super-admin` 7 个角色统一加上 `'Authenticated'`

2. **重新构建 delivery-plugin**
   - 执行 `npm run build`（tsc）编译 `src/*.ts` → `dist/`
   - 重启 Vendure dev-server，`DeliveryRoleSync` 日志显示 `Synced 0 roles, 7 permissions`

## 端到端验证流程

```
superadmin 登录 → 创建 delivery1 → delivery1 登录 → myPermissions ✓
→ 客户 zhangsan 下单 → 设置地址/配送方式 → admin-api addManualPaymentToOrder
→ 订单 PaymentSettled → 自动派单到 userId=8 → delivery1 看到 myDeliveries
→ startDelivery (assigned → in_progress) → markDelivered (in_progress → delivered)
→ 未登录访问被拒绝 ✓
```

## 复盘

- **1 个问题**：自定义角色权限映射表遗漏 `Authenticated` 基础权限，导致所有非超管角色无法访问任何受保护 API
- **1 个改进措施**：`RoleSyncService` 应在 `syncRoles()` 中自动为所有角色补齐 `Authenticated` 权限，而不是依赖人工在 `ROLE_PERMISSIONS_MAP` 中显式声明

## 测试账号

| 角色 | emailAddress | password | 用途 |
|------|-------------|----------|------|
| super-admin | superadmin@china.test | superadmin | 管理员 |
| delivery-staff | delivery1@zhao.test | a963963 | 送货员 |
| customer | zhangsan@test.cn | test | 下单客户 |
