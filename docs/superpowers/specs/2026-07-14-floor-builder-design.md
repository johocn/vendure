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

复用 Vendure 原生 `Collection`（ChannelAware，天然多租户隔离），通过 `customFields` 扩展楼层配置：

```typescript
// Collection customFields
{
  floorEnabled: boolean,        // 是否启用为首页楼层
  floorTitle: string,           // 楼层标题
  floorSubtitle: string,        // 副标题
  floorLayout: enum,            // 布局: single_scroll | double_grid | triple_grid | hero_with_list
  floorTheme: json,             // 主题: { primaryColor, backgroundColor, titleIcon }
  floorItemConfig: json,        // 单品排列: [{ productId, size, highlighted, label }]
  floorSortOrder: int,          // 楼层排序权重
  floorSchedule: json,          // 定时: { startAt, endAt }
  floorMaxScreens: int          // 最大屏数（默认3）
}
```

**多租户实现**：Collection 本身是 ChannelAware Entity，每个 Channel 独立创建自己的楼层 Collection，天然隔离，无需额外字段。

## 4. Admin 端搭建器

Vendure Admin UI Extension，注入到 Collection 编辑页：

- **选品面板**：左侧商品列表（支持搜索/筛选），拖拽或点击添加到楼层
- **配置面板**：右侧配置区，包含布局选择、主题色、标题文案、单品排列（拖拽排序、设置高亮/标签/大小）
- **实时预览**：中间区域实时渲染楼层效果（手机模拟器宽度）
- **多屏管理**：支持配置最多3屏，每屏独立选品和布局

## 5. 前端渲染

首页查询当前 Channel 下所有 `floorEnabled=true` 的 Collection，按 `floorSortOrder` 排序，动态渲染对应布局组件：

- `single_scroll`：单列横向滚动（swiper）
- `double_grid`：双列网格
- `triple_grid`：三列网格
- `hero_with_list`：大图主推 + 下方列表

每屏最多展示 `floorMaxScreens` 屏内容，超出不渲染。

## 6. 数据流

```
Admin 搭建器 → Collection.customFields 写入配置
              ↓
前端首页 → Shop API 查询 collections(filter: { floorEnabled: true })
              ↓
         按 floorSortOrder 排序
              ↓
         根据 floorLayout 动态渲染组件
              ↓
         单品数据从 Collection.products 获取
```

## 7. 错误处理

- Collection 无商品时，楼层不渲染（不报错）
- customFields 配置缺失时，使用默认值（默认布局、默认主题色）
- 定时上下线：`floorSchedule` 时间范围外不展示

## 8. 测试

- Admin 端：创建 Collection、配置 customFields、验证多 Channel 隔离
- 前端：default Channel 和 shop-a Channel 分别展示不同楼层
- 边界：空商品、配置缺失、定时过期
