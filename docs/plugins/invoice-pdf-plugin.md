# InvoicePdfPlugin

发票 PDF 生成插件，为中国税务发票生成标准格式的 PDF 文件并存储。

## 概述

`InvoicePdfPlugin` 基于 `pdfkit` 库生成符合中国税务规范的发票 PDF 文件，并通过 Vendure 的 `AssetStorageStrategy` 进行存储。管理员可以在订单详情页一键生成发票 PDF，生成后可在订单上查看 PDF 链接和发票号码。

## 安装

```bash
yarn add @vendure/invoice-pdf-plugin
```

或

```bash
npm install @vendure/invoice-pdf-plugin
```

## 配置

在 `vendure-config.ts` 中注册插件：

```ts
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';

const config: VendureConfig = {
  plugins: [
    InvoicePdfPlugin.init({
      storagePath: './invoices',
    }),
  ],
};
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `storagePath` | `string` | `'./invoices'` | PDF 文件存储路径 |

> `storagePath` 是本地文件系统路径，PDF 文件会存储在该目录下。如果配置了 S3 等远程存储的 `AssetStorageStrategy`，文件会存储到对应的远程位置。

## 自定义字段

插件为 `Order` 实体添加以下自定义字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `invoicePdfUrl` | `String` | 生成的发票 PDF 文件访问 URL |
| `invoiceNumber` | `String` | 发票号码（自动生成） |

## GraphQL API 参考

### Mutation: generateInvoicePdf

为指定订单生成发票 PDF。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderId` | `ID!` | 是 | 订单 ID |

**返回类型：** `InvoicePdfResult`

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | `String` | 生成的 PDF 文件访问 URL |
| `invoiceNumber` | `String` | 发票号码 |

**示例变更：**

```graphql
mutation GenerateInvoice {
  generateInvoicePdf(orderId: "1") {
    url
    invoiceNumber
  }
}
```

**示例响应：**

```json
{
  "data": {
    "generateInvoicePdf": {
      "url": "/assets/invoices/2024/01/INV-20240115-0001.pdf",
      "invoiceNumber": "INV-20240115-0001"
    }
  }
}
```

### 查询已生成的发票信息

通过 Order 查询获取发票 PDF 信息：

```graphql
query GetOrderInvoicePdf {
  order(id: "1") {
    id
    code
    customFields {
      invoicePdfUrl
      invoiceNumber
    }
  }
}
```

## 使用示例

### 1. 基本使用

```ts
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';

const config: VendureConfig = {
  plugins: [
    InvoicePdfPlugin.init({
      storagePath: './invoices',
    }),
  ],
};
```

### 2. 配合 InvoicePlugin 使用

`InvoicePlugin` 采集发票信息，`InvoicePdfPlugin` 生成 PDF，两者配合使用：

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

完整工作流：
1. 顾客下单时通过 `InvoicePlugin` 填写发票信息（抬头、税号等）
2. 管理员在 Dashboard 订单详情页点击「生成发票」按钮
3. `InvoicePdfPlugin` 读取订单的发票信息，生成 PDF 并存储
4. 订单的 `invoicePdfUrl` 和 `invoiceNumber` 字段被更新
5. 管理员和顾客可以通过 URL 下载发票 PDF

### 3. 使用 S3 存储

配合 Vendure 的 S3 AssetStorageStrategy，将 PDF 存储到云存储：

```ts
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';
import { S3AssetStorageStrategy } from '@vendure/asset-server-plugin';

const config: VendureConfig = {
  assetOptions: {
    assetStorageStrategy: new S3AssetStorageStrategy({
      bucket: 'my-invoices',
      region: 'cn-north-1',
    }),
  },
  plugins: [
    InvoicePdfPlugin.init({
      storagePath: 'invoices', // S3 上的 key 前缀
    }),
  ],
};
```

### 4. 批量生成发票

通过脚本批量生成发票 PDF：

```ts
// 独立脚本示例
import { createTestEnvironment } from '@vendure/testing';
import { GENERATE_INVOICE_PDF } from './admin-queries';

async function batchGenerateInvoice(orderIds: string[]) {
  for (const orderId of orderIds) {
    try {
      const result = await adminClient.query(GENERATE_INVOICE_PDF, { orderId });
      console.log(`Order ${orderId}: ${result.generateInvoicePdf.invoiceNumber}`);
    } catch (e) {
      console.error(`Order ${orderId} failed:`, e.message);
    }
  }
}
```

## Dashboard UI 扩展

插件在 Admin Dashboard 的 **Order 详情页** 添加以下 UI 元素：

- **生成发票按钮**：点击后调用 `generateInvoicePdf` 变更
- **发票信息展示**：显示发票号码和 PDF 下载链接
- **状态提示**：生成中显示 loading，生成完成显示成功通知

## PDF 内容说明

生成的发票 PDF 包含以下信息：

- 发票号码（自动生成，格式 `INV-YYYYMMDD-XXXX`）
- 开票日期
- 购买方信息（发票抬头、纳税人识别号）
- 商品明细（商品名称、数量、单价、金额）
- 合计金额（含税/不含税）
- 销售方信息

## 注意事项

1. **发票号码唯一性**：插件自动生成发票号码，确保唯一性。号码格式为 `INV-YYYYMMDD-XXXX`，其中 `XXXX` 为当日序号。如果需要对接税务系统的正式发票号码，需要自行扩展。
2. **pdfkit 依赖**：插件依赖 `pdfkit` 库生成 PDF，该库需要中文字体支持。确保服务器上安装了中文字体，或在插件初始化时配置字体路径。
3. **存储路径**：`storagePath` 为相对路径时，基于应用运行目录解析。生产环境建议使用绝对路径。
4. **重复生成**：对同一订单重复调用 `generateInvoicePdf` 会生成新的 PDF 并覆盖之前的文件，发票号码也会更新。如需防止重复生成，建议在调用前检查 `invoicePdfUrl` 字段是否已有值。
5. **数据库迁移**：插件注册后需要运行数据库迁移：
   ```bash
   npx vendure migrate
   ```
6. **大订单性能**：商品明细较多的订单生成 PDF 可能耗时较长，建议在后台任务中处理，避免阻塞 API 请求。
7. **字体问题**：如果生成的 PDF 中中文显示为方框或乱码，需要注册中文字体：
   ```ts
   // 在应用启动时注册字体（如使用 pdfkit）
   import PDFDocument from 'pdfkit';
   PDFDocument.registerFont('ChineseFont', '/path/to/font.ttf');
   ```
