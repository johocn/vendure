# 自提点创建流程中文化与地图选点改造 Design

**日期**: 2026-07-16
**作者**: brainstorming session
**状态**: 待实施

## 背景与目标

当前 `dashboard/pickup-locations/new` 页面存在以下问题：
1. 字段 label 全是英文（name/type/address/phoneNumber/businessHours/coordinates/partner）
2. `type` 字段无下拉选项，用户需手输 `store`/`point`/`employee`
3. `coordinates` 是 JSON 字段，默认渲染为 TextInput，用户需手写 `{"lat":xxx,"lng":xxx}`
4. 无省市区街道选择，地址只能整体手填
5. `isPublic` 字段未在 detail 页 query/update 中暴露
6. 缺少创建自提点的引导（用户不知道如何录入）

**目标**：
- 全中文 UI（label、placeholder、按钮、提示）
- `type` 改下拉选择（门店/驿站/员工自提点）
- `coordinates` 通过地图选点录入（高德地图）
- 省市区街道四级联动选择（数据源：高德行政区划 API）
- 后端抽象地图服务商接口，首版实现高德，为腾讯/百度预留
- 地图 API key 在后台 Channel 配置存储
- 旧数据复用（address 保留，省市区街道字段为空时降级）

## 范围边界

**包含**：
- 后端：PickupLocation 实体扩展 4 字段 + migration + GraphQL schema
- 后端：地图服务商抽象层（MapProvider 接口 + 高德实现 + 腾讯/百度占位）
- 后端：MapService + GraphQL 查询接口（districts/reverseGeocode/sdkConfig）
- 后端：Channel customFields.mapConfig 配置存储
- 前端：detail 页重写（Page + useDetailPage + 自定义表单）
- 前端：三个子组件（MapPicker / RegionCascadeSelector / MapSdkLoader）
- 前端：list 页中文化微调
- 前端：UI 内联提示（不写独立文档）
- 测试：后端单元 + e2e，前端组件单元 + 手动清单

**不包含**：
- 独立的 markdown 教程文档
- 删除 `address` 字段（保留冗余）
- 缓存行政区划数据到本地（每次实时查询高德 API）
- 前端直接调用高德 API（除 JS SDK 加载外，其余走后端代理）

## 第 1 节：后端数据模型与 Schema

### 1.1 PickupLocation 实体扩展

`cjk-plugin/src/pickup/pickup-location.entity.ts` 新增 4 个可空字段：

```typescript
@Column({ nullable: true }) province: string | null;
@Column({ nullable: true }) city: string | null;
@Column({ nullable: true }) district: string | null;
@Column({ nullable: true }) street: string | null;
```

保留 `address` 字段不动（冗余方案）。级联选择完成后前端自动拼接 `省+市+区+街道+详细地址` 写入 `address`。

### 1.2 GraphQL Schema 扩展

`cjk-plugin/src/plugin.ts` 扩展 `PickupLocation`、`CreatePickupLocationInput`、`UpdatePickupLocationInput`：

```graphql
type PickupLocation implements Node {
    # ... 现有字段
    province: String
    city: String
    district: String
    street: String
}

input CreatePickupLocationInput {
    # ... 现有字段
    province: String
    city: String
    district: String
    street: String
}

input UpdatePickupLocationInput {
    # ... 现有字段
    province: String
    city: String
    district: String
    street: String
}
```

### 1.3 Migration

新增 migration：`add-pickup-location-region-fields`，给 `pickup_location` 表加 4 个 nullable varchar 列。旧数据这 4 字段为 null，`address` 保持原值，编辑时由前端回填。

### 1.4 地图服务商配置存储

复用 Channel customFields 机制（参考已完成的 payConfig 模式），在 Channel 加 `mapConfig` 自定义字段：

```typescript
// cjk-plugin/src/map/map-config.ts
export interface MapProviderConfig {
    provider: 'amap' | 'tencent' | 'baidu';
    apiKey: string;        // 高德 key / 腾讯 key / 百度 AK
    securityJsCode?: string; // 高德安全密钥（高德专用）
}
```

通过 Channel.customFields.mapConfig 存储（JSON）。默认 Channel（默认租户）配置好后，子租户继承或覆盖。

### 1.5 地图配置查询接口（掩码展示用）

```graphql
extend type Query {
    # 获取当前 Channel 的地图配置（key 做掩码处理，仅用于后台展示）
    channelMapConfig: ChannelMapConfig!
}

type ChannelMapConfig {
    provider: String!
    apiKey: String!        # 掩码后的 key，如 "abc****xyz"，仅用于展示
    hasConfigured: Boolean!
}
```

**此接口不暴露完整 key**，仅用于后台配置页展示"已配置"状态。

**前端加载 SDK 用的真实 key 通过第 2.5 节的 `mapSdkConfig` 接口获取**（返回完整 sdkUrl，含 key）。这是地图服务商的通用做法：JS SDK 必须在浏览器端加载，key 必然暴露给前端。管理员后台场景下可接受。

## 第 2 节：地图服务商抽象层

### 2.1 MapProvider 抽象接口

```typescript
// cjk-plugin/src/map/map-provider.ts
export interface MapProvider {
    readonly name: 'amap' | 'tencent' | 'baidu';
    // 动态加载 JS SDK 的 URL 模板
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    // 行政区划查询 API（省市区街道级联数据源）
    fetchDistricts(parentAdcode: string): Promise<DistrictNode[]>;
    // 逆地理编码（经纬度 → 地址）
    reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult>;
}

export interface DistrictNode {
    adcode: string;     // 行政区划代码
    name: string;       // 行政区划名称
    level: 'province' | 'city' | 'district' | 'street';
    center: { lat: number; lng: number };
}

export interface ReverseGeocodeResult {
    province: string;
    city: string;
    district: string;
    street: string;
    formattedAddress: string;
}
```

### 2.2 三个 Provider 实现

```typescript
// cjk-plugin/src/map/providers/amap-provider.ts
export class AmapProvider implements MapProvider {
    readonly name = 'amap';
    getSdkLoaderUrl(apiKey, securityJsCode?) {
        return `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&plugin=AMap.Geocoder,AMap.DistrictSearch`;
    }
    async fetchDistricts(parentAdcode) {
        // 调用高德 /v3/config/district API
    }
    async reverseGeocode(lat, lng) {
        // 调用高德 /v3/geocode/regeo API
    }
}

// cjk-plugin/src/map/providers/tencent-provider.ts
export class TencentProvider implements MapProvider { /* 腾讯位置服务 */ }

// cjk-plugin/src/map/providers/baidu-provider.ts
export class BaiduProvider implements MapProvider { /* 百度地图开放平台 */ }
```

### 2.3 Provider 注册与解析

```typescript
// cjk-plugin/src/map/map-provider-registry.ts
export class MapProviderRegistry {
    private providers = new Map<string, MapProvider>();
    
    constructor() {
        this.register(new AmapProvider());
        this.register(new TencentProvider());
        this.register(new BaiduProvider());
    }
    
    register(provider: MapProvider) { this.providers.set(provider.name, provider); }
    get(name: string): MapProvider { /* ... */ }
}
```

### 2.4 MapService

```typescript
// cjk-plugin/src/map/map.service.ts
export class MapService {
    constructor(private registry: MapProviderRegistry) {}
    
    // 根据 Channel 配置解析 provider
    private getProviderForChannel(channelId: ID): { provider: MapProvider; config: MapProviderConfig } { /* ... */ }
    
    async getDistricts(channelId: ID, parentAdcode: string): Promise<DistrictNode[]> { /* ... */ }
    async reverseGeocode(channelId: ID, lat: number, lng: number): Promise<ReverseGeocodeResult> { /* ... */ }
    // 返回前端 SDK 加载 URL（key 不掩码，管理员后台可接受）
    getSdkConfig(channelId: ID): { provider: string; sdkUrl: string } { /* ... */ }
}
```

### 2.5 GraphQL 接口

```graphql
extend type Query {
    # 级联选择器数据源，parentAdcode 为空时返回省级列表
    mapDistricts(parentAdcode: String): [DistrictNode!]!
    # 逆地理编码
    reverseGeocode(lat: Float!, lng: Float!): ReverseGeocodeResult!
    # 前端 SDK 加载配置
    mapSdkConfig: MapSdkConfig!
}

type DistrictNode {
    adcode: String!
    name: String!
    level: String!
    center: LatLng!
}

type ReverseGeocodeResult {
    province: String
    city: String
    district: String
    street: String
    formattedAddress: String!
}

type MapSdkConfig {
    provider: String!
    sdkUrl: String!
}

type LatLng {
    lat: Float!
    lng: Float!
}
```

**关键设计决策**：
1. 行政区划数据每次实时查询高德 API，不缓存（数据量小，省市区共约 4000 条，单次查询返回一个层级）
2. 逆地理编码由后端代理调用，不暴露 key 给前端
3. JS SDK 加载 URL 暴露 key 给前端（地图渲染必须在浏览器端，这是地图服务商的通用做法，管理员后台场景可接受）

## 第 3 节：前端组件结构

### 3.1 文件结构

```
cjk-plugin/dashboard/
├── pickup-location-detail.tsx              # 重写：改用 Page + useDetailPage
├── pickup-location-list.tsx                # 微调：label 中文化
├── components/
│   ├── map-picker.tsx                      # 地图选点组件
│   ├── region-cascade-selector.tsx         # 省市区街道级联选择器
│   └── map-sdk-loader.ts                   # 高德 JS SDK 动态加载器
└── lib/
    └── map-graphql.ts                      # 地图相关 GraphQL 查询文档
```

### 3.2 MapSdkLoader

```typescript
// 单例模式，避免重复加载
let sdkPromise: Promise<any> | null = null;

export async function loadMapSdk(sdkUrl: string): Promise<any> {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = sdkUrl;
        script.onload = () => resolve((window as any).AMap);  // 高德默认挂 AMap
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return sdkPromise;
}
```

**注**：腾讯挂 `TMap`、百度挂 `BMap`。首版只实现高德，`map-picker.tsx` 内部判断 provider 类型调用对应 API。

### 3.3 RegionCascadeSelector — 4 级级联选择器

```tsx
interface RegionCascadeSelectorProps {
    value: { province: string; city: string; district: string; street: string };
    onChange: (value: RegionValue) => void;
}

// 4 个联动 Select：
// 1. 选省 → 调 mapDistricts(province.adcode) 拉市列表
// 2. 选市 → 调 mapDistricts(city.adcode) 拉区列表
// 3. 选区 → 调 mapDistricts(district.adcode) 拉街道列表
// 4. 选街道 → 触发 onChange
```

**关键设计**：
- 用 TanStack Query 缓存每级结果，key 为 adcode
- 选中后 `onChange` 回调同时返回 name 和 adcode，但提交后端只用 name
- 加载中显示 spinner，加载失败显示重试按钮

### 3.4 MapPicker — 地图选点组件

```tsx
interface MapPickerProps {
    value: { lat: number; lng: number } | null;
    onChange: (value: { lat: number; lng: number } | null) => void;
    defaultCenter?: { lat: number; lng: number };
}

// 行为：
// 1. 挂载后加载高德 JS SDK
// 2. 初始化地图，若有 value 则标记已有位置，否则定位到北京中心
// 3. 点击地图 → 放置标记 → 调逆地理编码 API → 触发 onChange
// 4. 支持搜索框（高德 PlaceSearch 插件）输入地址搜索
// 5. 提供"清除选点"按钮
```

**关键设计**：
- 容器高度固定 400px，宽度自适应
- 标记点带 infoWindow 显示当前坐标
- 搜索框使用高德 `AMap.PlaceSearch` + `AMap.AutoComplete`
- 逆地理编码由前端直接调后端 `reverseGeocode` GraphQL 接口（不直接调高德 API，保护 key）

### 3.5 pickup-location-detail.tsx 重写

```tsx
function PickupLocationDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const navigate = useNavigate();
    const { form, submitHandler, entity, isPending } = useDetailPage({
        queryDocument: getPickupLocationDetail,
        createDocument: createPickupLocation,
        updateDocument: updatePickupLocation,
        params: { id: params.id },
        setValuesForUpdate: loc => ({
            id: loc.id,
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
            coordinates: loc.coordinates,
            partner: loc.partner,
            province: loc.province,
            city: loc.city,
            district: loc.district,
            street: loc.street,
        }),
        onSuccess: async data => {
            toast.success(entity ? '更新成功' : '创建成功');
            if (!entity && data.id) {
                await navigate({ to: '../$id', params: { id: data.id } });
            }
        },
        onError: err => toast.error('保存失败: ' + err.message),
    });

    // 监听省市区街道变化，自动拼接 address
    const province = form.watch('province');
    const city = form.watch('city');
    const district = form.watch('district');
    const street = form.watch('street');
    const detailAddr = form.watch('address');
    
    useEffect(() => {
        const fullAddress = [province, city, district, street, detailAddr].filter(Boolean).join('');
        if (province || city || district || street) {
            form.setValue('address', fullAddress, { shouldDirty: true });
        }
    }, [province, city, district, street]);

    return (
        <Page pageId="pickup-location-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{entity?.name ?? '新建自提点'}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button type="submit" disabled={!form.formState.isDirty || isPending}>
                        {entity ? '保存' : '创建'}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="main" blockId="basic-info">
                    <DetailFormGrid>
                        {/* 基础字段：name, type(select), phoneNumber, businessHours, partner, isPublic(checkbox) */}
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="region-address">
                    <DetailFormGrid>
                        <RegionCascadeSelector /* ... */ />
                        {/* 详细地址输入框（address 字段，作为门牌号） */}
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="map-picker">
                    <MapPicker /* ... */ />
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
```

### 3.6 pickup-location-list.tsx 中文化微调

仅修改：
- 列标题：`ID` / `名称` / `类型` / `地址` / `操作`
- 按钮：`新建自提点`（已是）
- type 列显示中文映射：`store`→门店、`point`→驿站、`employee`→员工自提点

## 第 4 节：数据流与交互细节

### 4.1 创建自提点完整流程

```
用户进入 /pickup-locations/new
  ↓
DetailPage 挂载，useDetailPage 识别 isNew=true
  ↓
并行加载：
  - mapSdkConfig（拿 provider + sdkUrl）
  - mapDistricts()（拉省级列表）
  ↓
用户填写 name + 选 type
  ↓
用户操作 RegionCascadeSelector：
  选省 → useQuery(mapDistricts, province.adcode) → 拉市级
  选市 → useQuery(mapDistricts, city.adcode) → 拉区级
  选区 → useQuery(mapDistricts, district.adcode) → 拉街道级
  选街道 → 4 个字段写入 form
  ↓
useEffect 监听省市区街道 → 自动拼接写入 address 字段
  ↓
用户在地址输入框补全门牌号 → address 字段更新
  ↓
用户操作 MapPicker：
  点击地图 → 调 reverseGeocode GraphQL → 逆地理编码结果
    → 自动回填 province/city/district/street 到 form
    → 触发 RegionCascadeSelector 联动更新显示
    → 自动重新拼接 address
  或 用户在地图搜索框输入地址 → 定位 → 同上
  ↓
用户点击"创建" → 触发 submitHandler → createPickupLocation mutation
  ↓
onSuccess：toast.success('创建成功') + navigate 到详情页
```

### 4.2 编辑自提点流程

```
用户进入 /pickup-locations/$id
  ↓
useDetailPage 识别 isNew=false，查询 pickupLocation(id)
  ↓
entity 加载完成：
  - 基础字段填入 form
  - province/city/district/street 填入 form → RegionCascadeSelector 显示
    （注意：entity 只存 name 不存 adcode，需要先拉省级列表，
     按 name 匹配找到 adcode，再拉下级列表，逐级恢复选中状态）
  - coordinates 填入 form → MapPicker 显示标记
  ↓
用户修改任意字段 → form.isDirty = true
  ↓
点击"保存" → updatePickupLocation mutation
```

**编辑回显的卡点**：entity 只存 name，但级联选择器需要 adcode 查下级。解决方案：`RegionCascadeSelector` 内部维护 `name → adcode` 映射，回显时逐级匹配。若匹配失败（如旧数据无 province 字段），显示空状态，用户重新选择。

### 4.3 三个核心数据流

| 流向 | 触发 | 数据 | 目标 |
|------|------|------|------|
| 级联选择 → form | 用户选街道 | `{province, city, district, street}` | `form.setValue` + 触发 address 拼接 |
| 地图选点 → form | 用户点击地图 | `{lat, lng}` + 逆地理结果 | `form.setValue('coordinates')` + 回填省市区街道 |
| form → 后端 | 提交表单 | 全部字段 | `createPickupLocation` / `updatePickupLocation` |

### 4.4 address 自动拼接策略

```typescript
useEffect(() => {
    const regionPart = [province, city, district, street].filter(Boolean).join('');
    const fullAddress = regionPart + (detailAddress ?? '');
    
    // 仅当结构化字段任一非空时才覆盖
    if (regionPart) {
        form.setValue('address', fullAddress, { shouldDirty: true });
    }
    // 若全部清空，保留 detailAddress 原值
}, [province, city, district, street, detailAddress]);
```

**边界**：
- 旧数据编辑时（`province` 等为 null），不触发拼接，保留原 `address`
- 用户手动改 `address` 后，下次选省市区街道会再次覆盖（符合"结构化字段优先"原则）

### 4.5 MapConfig 未配置时的降级

```
mapSdkConfig 查询返回 hasConfigured=false
  ↓
MapPicker 显示提示："地图功能未配置，请联系管理员在后台配置地图服务"
  ↓
RegionCascadeSelector 显示提示："行政区划数据不可用，请手动输入地址"
  ↓
coordinates 字段降级为两个 NumberInput（lat/lng）
省市区街道降级为 4 个 TextInput
  ↓
用户仍可手动填写并提交（保证可用性）
```

## 第 5 节：错误处理与测试

### 5.1 错误处理矩阵

| 场景 | 错误类型 | 处理策略 | 用户感知 |
|------|---------|---------|---------|
| `mapSdkConfig` 查询失败 | 网络错误 | TanStack Query 自动重试 3 次 | 显示 loading，超时后降级 |
| 高德 JS SDK 加载失败 | script onerror | `loadMapSdk` reject，MapPicker 显示错误 | "地图加载失败，请刷新页面" + 重试按钮 |
| `mapDistricts` 查询失败 | 网络/高德 API 错误 | Query 不自动重试（避免刷屏），手动重试 | 当前级 Select 显示"加载失败" + 重试按钮 |
| `reverseGeocode` 失败 | 网络/高德 API 错误 | toast.error + 保留已选经纬度 | "逆地理编码失败，请手动选择行政区划" |
| 高德 API 返回限流 | HTTP 429 | 指数退避重试（2s/4s/8s） | loading 提示"请求中..." |
| `createPickupLocation` 失败 | 表单校验/后端错误 | useDetailPage onError → toast | "创建失败: " + 错误信息 |
| MapConfig 未配置 | hasConfigured=false | 降级为纯输入框（见 4.5） | 提示"地图功能未配置" |
| 级联回显 name 匹配 adcode 失败 | 旧数据无 province | Select 显示空，用户重选 | 不报错，静默降级 |
| 经纬度超出中国范围 | reverseGeocode 返回空 | 提示"该位置无行政区划数据" | toast.warning |

### 5.2 前端输入校验

```typescript
// name：必填，1-50 字符
// type：必填，枚举 store/point/employee
// address：必填，由自动拼接生成，用户无需手动填（但保留可编辑）
// phoneNumber：可选，格式校验 /^[\d\-+()\s]+$/
// coordinates：可选，但选了地图必须有值 {lat, lng}
// province/city/district/street：可选（允许只填 address）
```

校验通过 `react-hook-form` 的 zodResolver 或内联规则实现。

### 5.3 后端测试

**单元测试**（`map.service.spec.ts`）：
```typescript
describe('MapService', () => {
    it('getProviderForChannel 返回配置的 provider', async () => {});
    it('未配置时抛出 MapConfigNotConfiguredError', async () => {});
    it('fetchDistricts 透传 provider 结果', async () => {});
    it('reverseGeocode 透传 provider 结果', async () => {});
    it('provider 限流时指数退避重试', async () => {});
});

describe('AmapProvider', () => {
    it('fetchDistricts 解析高德响应为 DistrictNode[]', async () => {});
    it('reverseGeocode 解析高德 regeo 响应', async () => {});
    it('高德 API 返回错误状态码时抛出', async () => {});
    it('网络超时（>5s）时抛出 TimeoutError', async () => {});
});

describe('MapProviderRegistry', () => {
    it('register 后可 get', () => {});
    it('get 未注册 provider 抛出 ProviderNotFoundError', () => {});
    it('默认注册 amap/tencent/baidu 三个', () => {});
});
```

**Mock 策略**：用 `nock` 或 `msw` mock 高德 API 响应，不依赖真实 key。

**e2e 测试**（`pickup-location.e2e.ts` 扩展）：
```typescript
it('createPickupLocation 含 province/city/district/street 字段成功', async () => {});
it('updatePickupLocation 部分更新省市区街道', async () => {});
it('query pickupLocation 返回省市区街道字段', async () => {});
it('mapDistricts 查询省列表', async () => {});
it('reverseGeocode 返回结构化地址', async () => {});
it('channelMapConfig 掩码 apiKey', async () => {});
it('MapConfig 未配置时 mapDistricts 返回错误', async () => {});
```

### 5.4 前端测试

**组件单元测试**（Vitest + Testing Library）：
```typescript
// region-cascade-selector.test.tsx
it('选省后拉取市级列表', async () => {});
it('加载失败显示重试按钮', async () => {});
it('回显时按 name 匹配 adcode', async () => {});
it('onChange 回调返回 4 个字段', async () => {});

// map-picker.test.tsx
it('加载 SDK 后渲染地图', async () => {});
it('点击地图触发 onChange 和 reverseGeocode', async () => {});
it('SDK 加载失败显示错误提示', async () => {});
it('清除选点按钮触发 onChange(null)', async () => {});

// pickup-location-detail.test.tsx
it('新建模式表单为空', async () => {});
it('编辑模式回显所有字段', async () => {});
it('省市区街道变化自动拼接 address', async () => {});
it('提交触发 createPickupLocation', async () => {});
it('MapConfig 未配置时降级为输入框', async () => {});
```

**Mock 策略**：
- GraphQL 请求用 MSW mock
- 高德 SDK 用 `vi.mock` 模拟 `AMap` 全局对象
- 不渲染真实地图 DOM，只测试交互逻辑

### 5.5 手动测试清单

| # | 场景 | 预期 |
|---|------|------|
| 1 | 未配置 MapConfig 进入新建页 | 降级为输入框，可手动填写 |
| 2 | 配置高德 key 后进入新建页 | 地图和级联选择器正常加载 |
| 3 | 选省→市→区→街道 | 每级联动正确，address 自动拼接 |
| 4 | 点击地图选点 | 逆地理编码回填省市区街道 + address |
| 5 | 地图搜索框输入地址 | 定位 + 回填 |
| 6 | 提交新建 | 成功跳转详情页 |
| 7 | 编辑旧数据（无 province） | 级联回显空，address 保留 |
| 8 | 编辑旧数据（有 province） | 级联回显正确选中 |
| 9 | 高德 API 限流 | 退避重试，最终成功或提示 |
| 10 | 切换 Channel 不同 MapConfig | 各租户独立加载对应配置 |

## 关键技术约束

1. **DetailPage 组件不支持自定义字段渲染**（`detail-page.tsx` 用 `DefaultInputForType` 自动渲染所有字段，无 `fieldRenderers` prop），必须改用 `Page` + `useDetailPage` hook 完全自定义表单
2. **`useDetailPage` 的 `setValuesForUpdate` 在新建模式下不会被调用**（`use-generated-form.tsx:154-157` 有 `processedEntity ?` 保护），只需 `title` 回调加空值保护
3. **行政区划数据每次实时查询高德 API**，不缓存（数据量小，省市区共约 4000 条）
4. **JS SDK 加载 URL 暴露 key 给前端**（地图渲染必须在浏览器端，管理员后台场景可接受）
5. **腾讯/百度 Provider 首版只占位**，实现相同接口但不保证功能完整
6. **address 字段冗余保留**，由前端自动拼接，后端不强制校验一致性

## 参考文件

- 实体：[pickup-location.entity.ts](file:///e:/code/vendure/packages/cjk-plugin/src/pickup/pickup-location.entity.ts)
- Schema：[plugin.ts](file:///e:/code/vendure/packages/cjk-plugin/src/plugin.ts) 第 60-115 行
- 当前 detail 页：[pickup-location-detail.tsx](file:///e:/code/vendure/packages/cjk-plugin/dashboard/pickup-location-detail.tsx)
- 当前 list 页：[pickup-location-list.tsx](file:///e:/code/vendure/packages/cjk-plugin/dashboard/pickup-location-list.tsx)
- DetailPage 源码：[detail-page.tsx](file:///e:/code/vendure/packages/dashboard/src/lib/framework/page/detail-page.tsx)
- useDetailPage hook：[use-detail-page.ts](file:///e:/code/vendure/packages/dashboard/src/lib/framework/page/use-detail-page.ts)
- 测试数据：[sources.ts](file:///e:/code/vendure/packages/dev-server/china-data/sources.ts) 第 245-296 行
- payConfig 模式参考：已完成的多租户支付配置（Channel customFields + 加密工具）
