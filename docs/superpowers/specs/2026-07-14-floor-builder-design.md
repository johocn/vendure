# 首页楼层可视化搭建器设计（多租户）

## 1. 目标

在 Vendure Admin 后台提供"搭积木式"选品 + 外观配置能力，运营人员为每个 Channel（租户）创建首页楼层，前端动态渲染展示。纯展示，不涉及组合商品购买。

## 2. 核心约束

- 多租户：Channel 级隔离，每个 Channel 独立管理自己的楼层
- 展示位置：首页楼层
- 最多三屏滚动
- 纯展示，不购买
- 复用 Vendure 原生 Collection 能力

## 3. 数据模型

复用 Vendure 原生 `Collection`（ChannelAware，天然多租户隔离），通过 `customFields` 扩展楼层配置。

**注意**：Vendure customFields 不支持 `enum` 和 `json` 类型，使用 `string` + `select-form-input` 组件，复杂结构使用 `struct` 类型。

```typescript
// vendure-config.ts → customFields.Collection
{
  floorEnabled: boolean,           // 是否启用为首页楼层
  floorTitle: string,              // 楼层标题
  floorSubtitle: string,           // 副标题（简单文本，富文本用 Collection.description）
  floorLayout: string,             // 布局: 'single_scroll' | 'double_grid' | 'triple_grid' | 'hero_with_list'
                                   //   ui: { component: 'select-form-input', options: [...] }
  floorSortOrder: int,             // 楼层排序权重
  floorMaxScreens: int,            // 最大屏数（默认3）

  // 主题配置（struct 类型，非 json）
  floorTheme: struct {
    primaryColor: string,          // 主题色（如 '#ff6600'）
    backgroundColor: string,       // 背景色
    titleIcon: string,             // 标题图标 emoji 或 URL
  },

  // 单品排列（struct list，非 json；struct 子字段不支持 relation，productId 存为 string）
  floorItemConfig: struct[] {
    productId: string,             // 商品 ID（string，非 relation）
    size: string,                  // 展示尺寸: 'small' | 'medium' | 'large'
    highlighted: boolean,          // 是否高亮
    label: string,                 // 标签文案（如"新品"、"热销"）
  },

  // 定时上下线（struct 类型）
  floorSchedule: struct {
    startAt: datetime,             // 开始时间
    endAt: datetime,               // 结束时间
  },
}
```

**原生字段复用**：
- `Collection.featuredAsset`：直接用作楼层背景图，不在 customFields 重复定义
- `Collection.description`：用作楼层副标题富文本（需多语言时走 translations）
- `Collection.slug`：用作前端路由（如 `/floor/{slug}` 查看 Collection 详情）

**选品模式**：使用 `product-id-filter`（手动选品 CollectionFilter），运营在 Collection Contents 中手动添加商品。

**多租户实现**：Collection 本身是 ChannelAware Entity，`CollectionService.create` 自动调用 `assignToCurrentChannel`，每个 Channel 独立创建自己的楼层 Collection，天然隔离，无需额外字段。

**悬挂引用清理**：`floorItemConfig.productId` 以 string 存储（struct 不支持 relation），商品被删除后会产生悬挂引用。Plugin 订阅 `ProductEvent`（删除时），清理 `floorItemConfig` 中对应的 productId。

## 4. Admin 端搭建器

使用 Vendure V3 React Dashboard 的 `defineDashboardExtension`（非旧版 Angular uiExtensions），注入到 Collection 编辑页（pageId: `collection-detail`，blockId: `contents`，position: `after`）：

- **选品面板**：左侧商品列表（支持搜索/筛选），点击添加到楼层（复用原生 Collection Contents 的 `product-id-filter`）
- **配置面板**：右侧配置区，包含布局选择（select-form-input）、主题色、标题文案、单品排列（`floorItemConfig` 用 struct list，Dashboard 内置 `@dnd-kit` 支持拖拽排序）
- **实时预览**：中间区域实时渲染楼层效果（手机模拟器宽度 375px）
- **多屏管理**：支持配置最多3屏，每屏独立选品和布局（通过多个 Collection 实现，每个 Collection 是一屏）

## 5. 前端渲染

### 5.1 数据查询

首页查询当前 Channel 下所有 `floorEnabled=true` 的 Collection，按 `floorSortOrder` 排序：

```graphql
query GetFloors {
  collections {
    items {
      id
      slug
      name
      description
      featuredAsset { preview }
      customFields {
        floorEnabled
        floorTitle
        floorSubtitle
        floorLayout
        floorSortOrder
        floorMaxScreens
        floorTheme { primaryColor backgroundColor titleIcon }
        floorItemConfig { productId size highlighted label }
        floorSchedule { startAt endAt }
      }
      # 注意：Collection 没有 products 字段，用 productVariants
      productVariants(options: { take: 30 }) {
        items { id productId product { id name slug assets { preview } } }
      }
    }
  }
}
```

### 5.2 布局组件

根据 `floorLayout` 动态渲染对应布局组件：

- `single_scroll`：单列横向滚动（swiper）
- `double_grid`：双列网格
- `triple_grid`：三列网格
- `hero_with_list`：大图主推 + 下方列表

每屏最多展示 `floorMaxScreens` 屏内容，超出不渲染。

### 5.3 响应式降级规则

- `triple_grid` 在屏幕宽度 < 480px 时降级为 `double_grid`
- `hero_with_list` 在屏幕宽度 < 375px 时大图区域高度减半
- 小程序端 swiper 与 H5 行为不一致，组件内做平台条件编译

## 6. 交互定义

### 6.1 点击交互

- **点击楼层单品**：跳转到商品详情页 `/pkg-product/pages/detail?slug={product.slug}`
- **点击楼层标题**：跳转到 Collection 详情页 `/pkg-product/pages/list?collectionSlug={collection.slug}`
- **点击"查看更多"**（如有）：同上，跳转 Collection 详情页

### 6.2 空状态策略

- **所有楼层未启用或定时全部过期**：首页不渲染楼层区域，展示默认推荐位（fallback 到原生 `searchProducts({ take: 10 })`）
- **单个楼层无商品**：该楼层不渲染（不报错），其他楼层正常展示
- **customFields 配置缺失**：使用默认值（`floorLayout: 'double_grid'`、`floorTheme: { primaryColor: '#ff6600', backgroundColor: '#fff' }`）

## 7. 数据流

```
Admin 搭建器 → Collection.customFields 写入配置
              ↓
前端首页 → Shop API 查询 collections
              ↓
         过滤 floorEnabled=true 且在 floorSchedule 时间范围内
              ↓
         按 floorSortOrder 排序，取前 floorMaxScreens 个
              ↓
         根据 floorLayout 动态渲染组件
              ↓
         单品数据从 Collection.productVariants 获取
              ↓
         响应式降级：根据屏幕宽度调整布局
```

## 8. 错误处理

- Collection 无商品时，楼层不渲染（不报错）
- customFields 配置缺失时，使用默认值
- 定时上下线：`floorSchedule` 时间范围外不展示
- 商品被删除：Plugin 订阅 `ProductEvent` 清理 `floorItemConfig` 中的悬挂 productId
- `floorItemConfig` 中的 productId 在前端查询时若找不到对应商品，跳过该项

## 9. 缓存策略

- Collection 列表查询走 Vendure 原生 Query Cache，TTL ≤ 60s
- `floorSchedule` 涉及定时上下线，缓存 TTL 过长会导致过期楼层仍展示，故 TTL 不超过 60s

## 10. 权限控制

- 复用 Vendure 原生 `UpdateCollection` / `UpdateCatalog` 权限，无需新增自定义 Permission
- 所有可编辑 Collection 的角色均可配置楼层 customFields

## 11. 测试

- Admin 端：创建 Collection、配置 customFields、验证多 Channel 隔离
- 前端：default Channel 和 shop-a Channel 分别展示不同楼层
- 边界：空商品、配置缺失、定时过期、商品删除后的悬挂引用清理
- 响应式：H5 窄屏（<375px）、宽屏（>768px）、小程序端布局降级
