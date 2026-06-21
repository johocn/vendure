# InvoicePlugin

发票管理插件，为订单提供发票需求标记功能，支持普通发票、专用发票和电子发票三种类型。

## 概述

`InvoicePlugin` 为 Vendure 订单系统添加发票信息采集能力。顾客在下单时可以选择是否需要发票，并填写发票类型、发票抬头和税号等信息。管理员可以在 Dashboard 的订单详情页查看发票信息。

该插件通过 Order 自定义字段存储发票数据，无需额外的数据库表。

## 安装

```bash
yarn add @vendure/invoice-plugin
```

或

```bash
npm install @vendure/invoice-plugin
```

## 配置

在 `vendure-config.ts` 中注册插件：

```ts
import { InvoicePlugin } from '@vendure/invoice-plugin';

const config: VendureConfig = {
  plugins: [
    InvoicePlugin.init({
      enabledTypes: ['ordinary', 'special', 'electronic'],
    }),
  ],
};
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabledTypes` | `('ordinary' \| 'special' \| 'electronic')[]` | `['ordinary', 'special', 'electronic']` | 允许的发票类型 |

- `ordinary` — 普通发票
- `special` — 专用发票（增值税专用发票）
- `electronic` — 电子发票

如果不需要某种发票类型，可以在配置中移除，前端 UI 将不再显示该选项。

## 自定义字段

插件为 `Order` 实体添加以下自定义字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `invoiceRequired` | `Boolean` | 是否需要发票 |
| `invoiceType` | `String` | 发票类型：`ordinary`（普通）、`special`（专用）、`electronic`（电子） |
| `invoiceTitle` | `String` | 发票抬头 |
| `invoiceTaxNumber` | `String` | 纳税人识别号 |

## GraphQL API 参考

### Shop API

顾客在结算时设置发票信息，通过更新 Order 的自定义字段实现：

```graphql
mutation SetOrderInvoiceInfo {
  setOrderCustomFields(
    input: {
      invoiceRequired: true
      invoiceType: "special"
      invoiceTitle: "北京某某科技有限公司"
      invoiceTaxNumber: "91110000MA01XXXXX"
    }
  ) {
    ... on Order {
      id
      customFields {
        invoiceRequired
        invoiceType
        invoiceTitle
        invoiceTaxNumber
      }
    }
  }
}
```

### Admin API

管理员查询订单发票信息：

```graphql
query GetOrderInvoiceInfo {
  order(id: "1") {
    id
    code
    customFields {
      invoiceRequired
      invoiceType
      invoiceTitle
      invoiceTaxNumber
    }
  }
}
```

## 使用示例

### 1. 基本使用

只启用普通发票和电子发票：

```ts
InvoicePlugin.init({
  enabledTypes: ['ordinary', 'electronic'],
}),
```

### 2. 前端结算页面集成

在 Storefront 结算页面，根据 `enabledTypes` 配置渲染发票选项：

```ts
// 前端调用示例
const setInvoice = async (invoiceInfo) => {
  await shopClient.query(SetOrderCustomFields, {
    input: {
      invoiceRequired: true,
      invoiceType: invoiceInfo.type,
      invoiceTitle: invoiceInfo.title,
      invoiceTaxNumber: invoiceInfo.taxNumber,
    },
  });
};
```

### 3. 配合 InvoicePdfPlugin 使用

`InvoicePlugin` 负责采集发票信息，`InvoicePdfPlugin` 负责生成 PDF 文件。两者可以组合使用：

```ts
import { InvoicePlugin } from '@vendure/invoice-plugin';
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';

const config: VendureConfig = {
  plugins: [
    InvoicePlugin.init({
      enabledTypes: ['ordinary', 'special', 'electronic'],
    }),
    InvoicePdfPlugin.init({
      storagePath: './invoices',
    }),
  ],
};
```

## Dashboard UI 扩展

插件在 Admin Dashboard 的 **Order 详情页** 添加发票信息展示区域，显示：

- 是否需要发票
- 发票类型（中文标签）
- 发票抬头
- 纳税人识别号

## 注意事项

1. **字段验证**：当 `invoiceRequired` 为 `true` 时，`invoiceType`、`invoiceTitle` 和 `invoiceTaxNumber` 应为必填。建议在 Storefront 前端实现此验证逻辑。
2. **专用发票**：增值税专用发票通常需要额外的企业资质信息（如注册地址、电话、开户行等），本插件仅采集基本信息，如需扩展可通过额外的 Order 自定义字段实现。
3. **与 InvoicePdfPlugin 的关系**：`InvoicePlugin` 只负责标记和存储发票需求，不负责生成 PDF。如需生成发票 PDF，请配合使用 `InvoicePdfPlugin`。
4. **数据库迁移**：插件注册后需要运行数据库迁移以创建自定义字段列：
   ```bash
   npx vendure migrate
   ```
