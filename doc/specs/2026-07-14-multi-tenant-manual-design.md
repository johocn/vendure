# 多租户使用手册设计文档

## 1. 目标

为 Vendure 电商系统编写完整的多租户使用手册，覆盖运维操作和开发集成，使管理员和开发者能够基于该手册完成多租户配置、租户切换、配送/支付方式按租户配置等全流程操作。

## 2. 现状分析

- `doc/使用手册.md` — 通用使用手册，无多租户专项内容
- `doc/开发文档与规范.md` — 开发规范，未涉及多租户机制
- 无多租户专项使用手册

### 多租户实现现状

**后端（Vendure）：**
- Vendure 原生 Channel 机制：每个 Channel 可独立配置货币、语言、税收、配送、商品、价格
- `cjk-plugin` 的 `tenant` 模块：Channel 自定义字段（couponStackable、maxStackableCount）、TenantSetupService
- Channel 自定义字段通过 `CjkPlugin.init({ tenant: { enabled: true } })` 启用
- 当前 dev-config.ts 中 `CjkPlugin.init({ i18n: { enabled: true }, regions: { enabled: true } })` 未启用 tenant 模块

**前端（VShop）：**
- `src/stores/tenant.ts` — Pinia tenant store，管理租户 token、模板、功能开关
- `src/core/tenant.ts` — 租户识别工具（URL 参数、小程序 scene 参数）
- `src/api/client.ts` — 通过 `vendure-token` header 传递 Channel token
- `src/templates/registry.ts` — 模板注册表，按租户映射模板

## 3. 手册结构

### 3.1 多租户架构概述

- Vendure Channel 机制说明（Channel-aware entities、default Channel、Seller）
- 本项目多租户架构：cjk-plugin tenant 模块 + VShop tenant store
- 架构数据流图：前端租户识别 → vendure-token header → 后端 Channel 路由 → Channel-aware 数据隔离
- 多租户能力矩阵：商品/价格/货币/语言/配送/支付/促销/管理员权限

### 3.2 运维操作指南

- 创建新 Channel（Admin UI 操作步骤）
- Channel 基础配置：货币、语言、税收
- 按 Channel 配置配送方式（ShippingMethod 分配、自提点配置）
- 按 Channel 配置支付方式（PaymentMethod 分配、微信/支付宝/COD）
- 按 Channel 配置促销策略（couponStackable、maxStackableCount）
- 商品/价格分配到 Channel（ProductVariant 分配、多货币定价）
- 管理员权限分配（Role 限定 Channel）
- Channel token 获取与前端对接

### 3.3 开发集成指南

- 后端 cjk-plugin tenant 模块代码结构
- Channel 自定义字段扩展机制
- 前端 tenant store 机制详解
- vendure-token header 识别流程
- 模板系统（registry.ts、TemplateConfig）
- 功能开关按租户控制（features 字段）
- 扩展开发：新增 Channel 自定义字段、新增租户配置项

### 3.4 前后端租户切换

- 租户识别策略：URL 参数 → hostname → 小程序 scene → Storage
- H5 租户切换流程
- 小程序租户切换流程
- 切换后状态重置（resetClient、购物车清空）
- 租户持久化与恢复

### 3.5 多租户测试验证

- 端到端验证步骤（创建 Channel → 配置 → 前端切换 → API 验证）
- GraphQL 查询示例（带 vendure-token header）
- 前端切换验证
- 常见问题排查

## 4. 输出文件

- `e:\code\vendure\doc\多租户使用手册.md` — 多租户使用手册正文

## 5. 测试验证

手册编写完成后：
1. 启动 Vendure 后端（dev-server）
2. 启动 VShop 前端（H5 dev）
3. 验证手册中关键操作步骤可执行

## 6. 约束

- 手册语言：中文
- 遵循现有 `doc/使用手册.md` 和 `doc/开发文档与规范.md` 的文档风格
- 代码示例需基于实际项目代码，不使用伪代码
- 操作步骤需给出 Admin UI 路径和 GraphQL API 两种方式
