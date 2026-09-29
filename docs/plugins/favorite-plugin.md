# FavoritePlugin 收藏插件

## 概述

`FavoritePlugin` 为 Vendure 提供商品收藏与店铺关注能力，采用 toggle 语义（同一接口既收藏也取消），并按登录顾客做数据隔离。商品收藏后会实时重算收藏数并快照写入 `Product.customFields.favoriteCount`，便于列表卡片直接展示；店铺关注数则走动态聚合，不落缓存列。

**核心特性：**
- 商品收藏 / 店铺关注，toggle 幂等（同顾客对同一商品/店铺至多一条记录）
- 收藏数快照 `Product.favoriteCount`，toggle 后实时写回
- 登录态隔离：所有接口要求 `Permission.Authenticated`
- 多租户：`Favorite` 实现 `ChannelAware`，列表查询按 `ctx.channelId` 过滤
- 依赖 `ShopPlugin` 的 `Shop` 实体（店铺关注）

**包名：** `@vendure/favorite-plugin`

**类名：** `FavoritePlugin`

---

## 安装

```bash
npm install @vendure/favorite-plugin
```

---

## 配置说明

在 `vendure-config.ts` 中注册插件：

```ts
import { ShopPlugin } from '@vendure/shop-plugin';
import { FavoritePlugin } from '@vendure/favorite-plugin';

export const config = {
  // ...
  plugins: [
    // ShopPlugin 必须在 FavoritePlugin 之前注册：myFollowedShops 依赖其 Shop 实体
    ShopPlugin.init({}),
    FavoritePlugin.init(),
  ],
};
```

### 配置项

本插件暂无配置项（`FavoritePluginOptions` 为空接口），保留 `init()` 以统一调用形式。

初装时插件会：
- 建表 `favorite`
- 合并 `Product.favoriteCount` 自定义字段（`int` / `nullable` / `public`）

> 若 `dbConnectionOptions.synchronize` 为 `true`，表与字段由 TypeORM 自动同步创建；生产环境按既有迁移策略处理。

---

## 数据模型

### Favorite（收藏/关注记录）

单表承载两类记录：收藏商品时 `productId` 非空，关注店铺时 `shopId` 非空（二者其一）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 记录唯一标识 |
| `customerId` | `Int` | 顾客 ID |
| `productId` | `Int \| null` | 收藏的商品 ID（收藏记录非空） |
| `shopId` | `Int \| null` | 关注的店铺 ID（关注记录非空） |
| `channelId` | `Int` | 渠道 ID（多租户隔离） |
| `channels` | `Channel[]` | `ChannelAware` 关联 |
| `createdAt` | `DateTime` | 创建时间（`VendureEntity` 基类） |
| `updatedAt` | `DateTime` | 更新时间（`VendureEntity` 基类） |

唯一约束：

- `(customerId, productId)`
- `(customerId, shopId)`

两条复合唯一索引保证同一顾客对同一商品或店铺天然幂等。

### Product 自定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `favoriteCount` | `Int` | 商品收藏数快照（`public`，`nullable`），`toggleFavoriteProduct` 后实时重算写回，对齐 ReviewPlugin 的评分快照口径 |

---

## GraphQL API 参考

本插件仅扩展 **Shop API**，无 Admin API 变更。

### Shop API

#### Query

| 接口 | 权限 | 说明 |
|------|------|------|
| `myFavoriteProducts: [Product!]!` | `Authenticated` | 当前顾客收藏的商品，按收藏时间倒序 |
| `isProductFavorite(productId: ID!): Boolean!` | `Authenticated` | 商品是否已被当前顾客收藏 |
| `myFollowedShops: [Shop!]!` | `Authenticated` | 当前顾客关注的店铺，按关注时间倒序 |
| `isShopFollowed(shopId: ID!): Boolean!` | `Authenticated` | 店铺是否已被当前顾客关注 |
| `shopFollowerCount(shopId: ID!): Int!` | `Authenticated` | 店铺关注数（动态聚合，不落缓存列） |

**查询收藏列表与收藏状态**

```graphql
query MyFavorites($productId: ID!) {
  myFavoriteProducts {
    id
    name
    slug
    customFields {
      favoriteCount
    }
  }
  isProductFavorite(productId: $productId)
}
```

**查询关注店铺与关注数**

```graphql
query MyFollowedShops($shopId: ID!) {
  myFollowedShops {
    id
    name
    slug
  }
  isShopFollowed(shopId: $shopId)
  shopFollowerCount(shopId: $shopId)
}
```

#### Mutation

| 接口 | 权限 | 说明 |
|------|------|------|
| `toggleFavoriteProduct(productId: ID!): Boolean!` | `Authenticated` | 切换商品收藏，返回**操作后**的状态（`true` = 已收藏） |
| `toggleFollowShop(shopId: ID!): Boolean!` | `Authenticated` | 切换店铺关注，返回**操作后**的状态（`true` = 已关注） |

**切换商品收藏**

```graphql
mutation ToggleFavorite($productId: ID!) {
  toggleFavoriteProduct(productId: $productId)
}
```

返回值语义：首次调用返回 `true`（已收藏），再次调用返回 `false`（已取消），无需前端自行判断当前状态。

---

## 业务流程详解

### 收藏 / 取消流程

1. 校验登录态 → 未登录抛 `UnauthorizedError`
2. 校验目标商品 / 店铺存在 → 不存在抛 `EntityNotFoundError`
3. 按 `(customerId, productId)` 或 `(customerId, shopId)` 查记录
   - 命中：删除记录，返回 `false`
   - 未命中：插入记录，返回 `true`
4. 商品收藏额外重算并写回 `Product.favoriteCount`

### 计数口径

| 计数 | 口径 | 说明 |
|------|------|------|
| `Product.favoriteCount` | **跨渠道聚合**：仅按 `productId` 统计 | 面向 C 端展示的「收藏数」热度值 |
| `shopFollowerCount` | **跨渠道聚合**：仅按 `shopId` 统计 | 同上 |
| `myFavoriteProducts` / `myFollowedShops` | **按渠道过滤**：`customerId` + `ctx.channelId` | 列表只返回当前渠道内的收藏 |

> 计数为全渠道聚合、列表为单渠道隔离，这是有意取舍：热度值不应因租户拆分而被稀释，而顾客的个人列表必须留在本渠道。

### 错误对照

| 场景 | 返回 |
|------|------|
| 未登录 | `You are not currently authorized to perform this action` |
| 商品 / 店铺不存在 | `EntityNotFoundError` |
| 无 Customer 记录（如管理员 Token） | `EntityNotFoundError` |

---

## 与其他插件集成

| 插件 | 关系 | 说明 |
|------|------|------|
| `ShopPlugin` | **必需** | `myFollowedShops` / `isShopFollowed` / `toggleFollowShop` 依赖其 `Shop` 实体，必须在 `FavoritePlugin` 之前注册 |
| `ReviewPlugin` | 口径对齐 | 同样以 `Permission.Authenticated` 守卫、同样把统计快照写入 `Product.customFields` |

---

## 注意事项

- **登录态强依赖**：5 个 Query 与 2 个 Mutation 全部要求登录，游客调用直接返回未授权；前端需在未登录时先行引导登录。
- **列表顺序**：收藏/关注列表按记录 `createdAt` 倒序（最近操作在前），不受商品/店铺更新时间影响。
- **越权隔离**：所有读写均以 `customerId` 为条件，顾客之间互不可见；跨顾客校验在 e2e 用例中有专门覆盖。
- **无 Admin API**：本插件不提供管理端接口，收藏数据仅供 C 端读取。
