# 自提点地图快速定位改造 Design Spec

**日期**: 2026-07-16
**关联**: 2026-07-16-pickup-location-create-redesign-design.md（前置 spec，已完成实施）

## 背景

前置 spec 完成了自提点创建页的中文化、地图选点、省市区街道级联。但用户反馈**通过地图选地址不方便**：默认中心是天安门，用户要找双阳得手动拖拽+缩放。需要快速定位机制。

## 核心目标

让运营人员在 Dashboard 后台创建自提点时，能快速定位到目标位置，无需手动拖拽地图。

## 范围

- **只改 Dashboard**（`packages/cjk-plugin/dashboard/`），不改 vshop 前端
- 只改 `pickup-location-detail.tsx` 详情页（新建/编辑自提点）
- 不改后端（GraphQL schema 已就绪，`mapDistricts` 已返回 `center` 字段）

## 4 个功能设计

### 功能 1：GPS 定位按钮

**位置**：MapPicker 顶部工具栏（"点击地图选择位置"提示右侧）

**交互**：
1. 点击"定位当前位置"按钮
2. 调 `navigator.geolocation.getCurrentPosition()` 获取坐标
3. 地图 `setCenter` + 加标记
4. 调后端 `reverseGeocode` 回填省市区街道
5. `onChange` 回传坐标给 form

**约束**：
- PC 端靠 IP 定位，偏差几公里（可接受，用户会再微调）
- 需要 HTTPS（localhost 也算安全上下文，开发可用）
- 用户可能拒绝授权 → 显示 toast 提示"定位失败，请手动搜索或点击地图"
- 加 loading 状态（定位中按钮禁用 + spinner）

### 功能 2：地址搜索框

**位置**：MapPicker 顶部工具栏（GPS 按钮左侧）

**交互**：
1. 输入关键词（"双阳""欧亚卖场""长春日报社"）
2. 调 `AMap.AutoComplete.search(keyword)` 联想下拉
3. 选中某条结果 → 拿 `location`（含 lng/lat）
4. 地图 `setCenter` + 加标记
5. 调后端 `reverseGeocode` 回填省市区街道
6. `onChange` 回传坐标给 form

**约束**：
- AutoComplete 插件已在 `map-sdk-loader.ts` 的 plugins 参数中加载（`AMap.AutoComplete`）
- AutoComplete 返回的 `location` 是 `{lng, lat}` 对象，可直接用
- 不需要再调 PlaceSearch（AutoComplete 已返回坐标）
- 最小输入 2 字符才触发搜索，避免无效请求
- 防抖 300ms

### 功能 3：省市区联动地图

**位置**：RegionCascadeSelector 选完后触发

**交互**：
1. 选省 → 用 `mapDistricts` 返回的 `center` 调 `map.setCenter` + `setZoom(7)`
2. 选市 → `setCenter` + `setZoom(9)`
3. 选区 → `setCenter` + `setZoom(11)`
4. 选街道 → `setCenter` + `setZoom(13)`

**约束**：
- `mapDistricts` 已返回 `center: {lat, lng}`，无需新增后端查询
- 通过 `onRegionCenterChange(center)` 回调透传给父组件，父组件调 MapPicker 暴露的 `setCenter` 方法
- 只定位到区/街道中心，不到具体门牌（用户需手动微调或用搜索）
- 不自动加标记（只移动地图视角）

### 功能 4：详细地址自动联想

**位置**：详情页"详细地址"输入框（替换原 TextInput）

**交互**：
1. 用户输入关键词（"西双阳大街""欧亚卖场"）
2. 调 `AMap.AutoComplete.search(keyword)` 联想下拉
3. 选中某条结果：
   - 回填详细地址字段（`address`）为选中项的 `name`
   - 调 `reverseGeocode` 回填省市区街道
   - 通知 MapPicker 跳转 + 加标记（通过 `onLocationSelect` 回调）
   - `coordinates` 字段同步更新

**约束**：
- 单独做一个 `AddressAutoComplete` 组件（包裹原生 input）
- 需要把 MapPicker 的 `setCenter(lng, lat)` 方法暴露给父组件
- 最小输入 2 字符触发，防抖 300ms
- 与 form 集成用 `Controller` 包裹

## 架构设计

### 组件关系

```
PickupLocationDetailPage
├── FormFieldWrapper (name, type, phoneNumber, ...)
├── Controller (province) → RegionCascadeSelector
│   └── onRegionCenterChange(center) → mapPickerRef.setCenter(center)
├── FormFieldWrapper (address) → AddressAutoComplete
│   └── onLocationSelect({lng, lat}) → mapPickerRef.setCenter(lng, lat) + form.setValue('coordinates', ...)
└── Controller (coordinates) → MapPicker (forwardRef)
    ├── 顶部工具栏: [地址搜索框] [GPS定位按钮]
    ├── 地图区域
    └── 底部: 坐标显示
```

### MapPicker 改造

用 `forwardRef` + `useImperativeHandle` 暴露：
- `setCenter(lng: number, lat: number, withMarker?: boolean)`: 移动地图视角，可选加标记
- `clearMarker()`: 清除标记

### 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `dashboard/components/map-picker.tsx` | 修改 | 加 GPS 按钮 + 地址搜索框 + forwardRef 暴露 setCenter |
| `dashboard/components/address-auto-complete.tsx` | 创建 | 详细地址自动联想组件 |
| `dashboard/components/region-cascade-selector.tsx` | 修改 | 加 onRegionCenterChange 回调 |
| `dashboard/pickup-location-detail.tsx` | 修改 | 集成 AddressAutoComplete + mapPickerRef + onRegionCenterChange |

## 降级策略

1. **mapConfig 未配置**：MapPicker 显示提示，GPS 按钮和搜索框不显示，AddressAutoComplete 降级为普通 TextInput
2. **GPS 定位失败**：toast 提示，不影响其他功能
3. **AutoComplete 搜索失败**：搜索框下拉显示"搜索失败"，不影响手动输入
4. **SDK 加载失败**：同 mapConfig 未配置降级

## i18n

所有新增文案用 `<Trans>` 包裹：
- "定位当前位置"
- "搜索地址"
- "定位中..."
- "定位失败，请手动搜索或点击地图"
- "搜索失败"
- "无结果"

## 风险点

1. **AutoComplete 付费**：个人开发者每日 30 万次免费额度，后台运营调用量低，成本可忽略
2. **GPS 偏差**：PC 端 IP 定位偏差几公里，用户需微调，可接受
3. **HTTPS 要求**：localhost 是安全上下文，生产环境需 HTTPS
4. **地图实例生命周期**：`setCenter` 可能在地图未初始化时调用，需加保护
