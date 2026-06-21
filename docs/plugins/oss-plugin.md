# OssPlugin

## 概述

`OssPlugin` 是一个 Vendure 资产存储插件，将 Vendure 的资产（图片、文件等）存储到阿里云 OSS（Object Storage Service），替代默认的本地文件存储方案。

- **包名**：`@vendure/oss-plugin`
- **类名**：`OssPlugin`

### 为什么需要这个插件？

Vendure 默认使用本地文件系统存储资产，这在以下场景中存在局限：

- **多实例部署**：多个服务器实例无法共享本地文件
- **CDN 加速**：无法利用 CDN 分发静态资源
- **存储成本**：本地磁盘不适合存储大量图片和文件

OssPlugin 通过替换 Vendure 的 `AssetStorageStrategy`，将所有资产存储到阿里云 OSS，并支持自定义 CDN 域名，完美解决以上问题。

---

## 安装

```bash
npm install @vendure/oss-plugin
```

### 前置条件

1. 拥有阿里云账号，并开通 OSS 服务
2. 创建了 OSS Bucket
3. 获取了 AccessKey ID 和 AccessKey Secret（建议使用 RAM 子账号，仅授予 OSS 权限）

---

## 配置说明

### 配置项

```ts
interface OssPluginOptions {
    region: string;           // OSS 区域，如 'oss-cn-hangzhou'
    accessKeyId: string;      // 阿里云 AccessKey ID
    accessKeySecret: string;  // 阿里云 AccessKey Secret
    bucket: string;           // OSS Bucket 名称
    endpoint?: string;        // 自定义 endpoint
    pathPrefix?: string;      // 文件路径前缀，如 'vendure-assets'
    customDomain?: string;    // CDN 自定义域名，如 'cdn.example.com'
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `region` | `string` | 是 | - | OSS 区域，如 `oss-cn-hangzhou`、`oss-cn-beijing`、`oss-cn-shanghai` |
| `accessKeyId` | `string` | 是 | - | 阿里云 AccessKey ID |
| `accessKeySecret` | `string` | 是 | - | 阿里云 AccessKey Secret |
| `bucket` | `string` | 是 | - | OSS Bucket 名称 |
| `endpoint` | `string` | 否 | - | 自定义 endpoint，设置后将忽略 `region` |
| `pathPrefix` | `string` | 否 | - | 文件路径前缀，用于在 Bucket 中组织文件目录 |
| `customDomain` | `string` | 否 | - | CDN 自定义域名，设置后所有文件 URL 将使用 `https://{customDomain}/{key}` 格式 |

### 基础配置

在 `vendure-config.ts` 中添加插件：

```ts
import { VendureConfig } from '@vendure/core';
import { OssPlugin } from '@vendure/oss-plugin';

export const config: VendureConfig = {
    // ...其他配置
    plugins: [
        OssPlugin.init({
            region: 'oss-cn-hangzhou',
            accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
            accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
            bucket: 'my-vendure-assets',
            pathPrefix: 'vendure-assets',
        }),
    ],
};
```

### 使用 CDN 自定义域名

如果你在阿里云 CDN 中绑定了自定义域名，可以通过 `customDomain` 配置让所有资产 URL 使用 CDN 域名：

```ts
OssPlugin.init({
    region: 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: 'my-vendure-assets',
    pathPrefix: 'vendure-assets',
    customDomain: 'cdn.example.com',
}),
```

配置后，资产 URL 将从默认的 OSS 域名格式：

```
https://my-vendure-assets.oss-cn-hangzhou.aliyuncs.com/vendure-assets/product/image.jpg
```

变为 CDN 域名格式：

```
https://cdn.example.com/vendure-assets/product/image.jpg
```

### 使用自定义 Endpoint

如果你使用的是阿里云金融云、政务云等特殊环境的 OSS，可以通过 `endpoint` 指定：

```ts
OssPlugin.init({
    endpoint: 'https://oss-cn-hangzhou-finance.aliyuncs.com',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: 'my-vendure-assets',
}),
```

---

## 工作原理

OssPlugin 通过替换 Vendure 的 `AssetStorageStrategy` 实现，完整实现了以下方法：

| 方法 | 说明 |
|------|------|
| `writeFileFromBuffer` | 将 Buffer 数据写入 OSS |
| `writeFileFromStream` | 将 Stream 数据写入 OSS |
| `readFileToBuffer` | 从 OSS 读取文件为 Buffer |
| `readFileToStream` | 从 OSS 读取文件为 Stream |
| `deleteFile` | 从 OSS 删除文件 |
| `fileExists` | 检查文件是否存在于 OSS |
| `toAbsoluteUrl` | 将相对路径转为完整的 OSS/CDN URL |

### 文件存储流程

```
用户上传文件 → Vendure AssetService → OssPlugin.writeFileFromBuffer/Stream
                                            ↓
                                    写入阿里云 OSS Bucket
                                            ↓
                                    返回 toAbsoluteUrl 生成的 URL
```

### URL 生成逻辑

- 未设置 `customDomain`：`https://{bucket}.{region}.aliyuncs.com/{pathPrefix}/{fileName}`
- 设置了 `customDomain`：`https://{customDomain}/{pathPrefix}/{fileName}`

---

## GraphQL API 参考

OssPlugin 不扩展 GraphQL API，它仅在服务端替换资产存储策略，对前端透明。

---

## 使用示例

### 场景一：基础电商网站

```ts
import { VendureConfig } from '@vendure/core';
import { OssPlugin } from '@vendure/oss-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';

export const config: VendureConfig = {
    plugins: [
        // 注意：使用 OssPlugin 后，不再需要 AssetServerPlugin 来存储文件
        // 但 AssetServerPlugin 仍可用于图片缩放等预处理功能
        OssPlugin.init({
            region: 'oss-cn-shanghai',
            accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
            accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
            bucket: 'my-shop-assets',
            pathPrefix: 'shop',
        }),
    ],
};
```

### 场景二：多渠道 + CDN 加速

```ts
OssPlugin.init({
    region: 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: 'my-multi-channel-assets',
    pathPrefix: 'assets',
    customDomain: 'static.myshop.com',
}),
```

### 环境变量管理

建议通过环境变量管理敏感信息，不要将 AccessKey 硬编码在代码中：

```env
# .env
OSS_ACCESS_KEY_ID=LTAI5tXXXXXXXXXXXXXX
OSS_ACCESS_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=my-vendure-assets
OSS_PATH_PREFIX=vendure-assets
OSS_CUSTOM_DOMAIN=cdn.example.com
```

```ts
OssPlugin.init({
    region: process.env.OSS_REGION!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: process.env.OSS_BUCKET!,
    pathPrefix: process.env.OSS_PATH_PREFIX,
    customDomain: process.env.OSS_CUSTOM_DOMAIN,
}),
```

---

## 与其他插件集成

### 与 AssetServerPlugin 配合

OssPlugin 替换了 `AssetStorageStrategy`，但 `AssetServerPlugin` 的图片预处理（缩放、裁剪、格式转换）功能仍然可用。两者可以同时使用：

```ts
plugins: [
    AssetServerPlugin.init({
        route: 'assets',
        assetUploadDir: '/tmp/vendure-assets', // 临时目录，用于预处理
    }),
    OssPlugin.init({
        // ...OSS 配置
    }),
],
```

> **注意**：当两者同时使用时，图片预处理在本地临时目录完成，最终文件存储到 OSS。

### 与默认搜索插件集成

OssPlugin 与 `DefaultSearchPlugin` 无冲突，资产 URL 会自动使用 OSS/CDN 地址。

---

## 注意事项

1. **AccessKey 安全**：务必使用环境变量管理 AccessKey，不要提交到代码仓库。建议使用 RAM 子账号，仅授予 OSS 读写权限。

2. **Bucket 权限**：建议将 Bucket 设置为私有读写，通过 CDN 或签名 URL 访问文件。如果需要公开访问，可将 Bucket 设置为公共读。

3. **CORS 配置**：如果前端直接访问 OSS 资源（未使用 CDN），需要在 OSS Bucket 中配置 CORS 规则，允许你的前端域名访问。

4. **迁移已有资产**：从本地存储迁移到 OSS 时，需要手动将已有文件上传到 OSS 的对应路径，并更新数据库中的资产记录。

5. **pathPrefix 用途**：`pathPrefix` 用于在同一个 Bucket 中隔离不同环境的文件，例如开发环境和生产环境可以使用不同的 `pathPrefix`。

6. **customDomain 配置**：使用 `customDomain` 前需确保已在阿里云 CDN 控制台完成域名绑定和 CNAME 解析配置。

7. **大文件上传**：对于超大文件（>5GB），OSS 需要使用分片上传，当前插件版本暂不支持分片上传，请确保上传文件大小在限制范围内。
