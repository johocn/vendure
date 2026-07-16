# 自提点前端改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写自提点详情页（中文化 + 地图选点 + 省市区街道级联），微调列表页中文化。

**Architecture:** 前端三个子组件 + 详情页重写：(1) `MapSdkLoader` 单例加载高德 JS SDK；(2) `RegionCascadeSelector` 4 级联动 Select，数据来自后端 mapDistricts；(3) `MapPicker` 地图选点，点击调后端 reverseGeocode 回填。详情页用 `useDetailPage` hook 拿 form state，手动用 `FormFieldWrapper`/`Controller` 渲染每个字段（不使用 DetailFormGrid 自动渲染）。

**Tech Stack:** React + Vendure Dashboard (Page/useDetailPage/FormFieldWrapper/Controller) + TanStack Query + react-hook-form + 高德 JS API 2.0

**依赖**：本 plan 依赖后端 plan（`2026-07-16-pickup-location-backend.md`）已完成，GraphQL schema 已暴露 `PickupLocationType` enum、省市区街道字段、`mapDistricts/reverseGeocode/mapSdkConfig/channelMapConfig` 查询。

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `e:\code\vendure\packages\cjk-plugin\dashboard\lib\map-graphql.ts` | 创建 | 地图相关 GraphQL 查询文档 |
| `e:\code\vendure\packages\cjk-plugin\dashboard\components\map-sdk-loader.ts` | 创建 | 高德 JS SDK 单例加载器 |
| `e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx` | 创建 | 省市区街道 4 级级联选择器 |
| `e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx` | 创建 | 地图选点组件 |
| `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-detail.tsx` | 重写 | 详情页，用 Page + useDetailPage + 手动渲染 |
| `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx` | 修改 | 列标题中文化 + type 中文映射 |

---

## 关键约束（已验证）

1. **`useDetailPage` hook 不支持自定义字段渲染**：它用 `useGeneratedForm` 自动从 GraphQL document 推导字段，用 `DefaultInputForType` 渲染。要自定义控件，必须用 `Page` + `useDetailPage` 拿 form state，然后在 JSX 中手动用 `FormFieldWrapper`（普通字段）或 `Controller`（自定义控件）渲染
2. **`DetailFormGrid` 是纯布局 div**（`grid @md:grid-cols-2 gap-6`），只是容器，子组件由开发者决定放什么
3. **`FormFieldWrapper`、`SelectWithOptions`、`TextInput`、`BooleanInput`、`Page`、`PageLayout`、`PageBlock`、`PageActionBar`、`PageActionBarRight`、`PageTitle`、`useDetailPage`、`graphql`、`api`、`toast` 均从 `@vendure/dashboard` 导出**
4. **`Controller` 从 `react-hook-form` 导入**（不是 `@vendure/dashboard`）
5. **高德 JS API 2.0**：加载后挂全局 `window.AMap`，通过 `new AMap.Map(container, options)` 初始化
6. **Dashboard 编译方式**：cjk-plugin dashboard tsx 文件由 dev-server 的 Vite 插件 `vendureDashboardPlugin` 直接编译，无需 `npm run build`
7. **type 字段用 SelectWithOptions 手动传 options**：因为 GraphQL enum 在 form schema 中可能不自动带 options，需手动指定
8. **coordinates 字段是 simple-json**：useGeneratedForm 会渲染为 TextInput，必须用 Controller 包裹 MapPicker 覆盖
9. **useDetailPage 的 setValuesForUpdate 在新建模式下不会被调用**（有 processedEntity 保护），只需 title 回调加空值保护
10. **多语言机制**：Vendure Dashboard 用 `@lingui/cli` 管理，`sourceLocale: 'en'`，所有用户可见文案必须用 `@lingui/react/macro` 的 `<Trans>...</Trans>` 包裹。cjk-plugin 现有代码混用：英文源文案（如 `<Trans>Pickup Locations</Trans>`）和中文源文案（如 `<Trans>新建自提点</Trans>`）都存在。**本 plan 采取实用策略**：所有文案用 `<Trans>` 包裹，文案本身用中文（cjk-plugin 是中国特化插件，主要面向中文用户；lingui 仍会提取 msgid，未来可翻译其他语言）
11. **toast 消息也应用 `<Trans>` 包裹**：但 `toast.success(msg)` 接收 string，需要用 `i18n._(t\`msg\`)` 模式。简化方案：toast 消息硬编码中文（与现有 pickup-location-list.tsx 的 `toast.success('删除成功')` 一致），不走 lingui

---

## Task 1: 创建 lib/map-graphql.ts

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\lib\map-graphql.ts`

- [ ] **Step 1: 创建 map-graphql.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\dashboard\lib\map-graphql.ts
import { graphql } from '@vendure/dashboard';

export const getMapSdkConfig = graphql(`
    query GetMapSdkConfig {
        mapSdkConfig {
            provider
            sdkUrl
            hasConfigured
        }
    }
`);

export const getMapDistricts = graphql(`
    query GetMapDistricts($parentAdcode: String) {
        mapDistricts(parentAdcode: $parentAdcode) {
            adcode
            name
            level
            center {
                lat
                lng
            }
        }
    }
`);

export const reverseGeocode = graphql(`
    query ReverseGeocode($lat: Float!, $lng: Float!) {
        reverseGeocode(lat: $lat, lng: $lng) {
            province
            city
            district
            street
            formattedAddress
        }
    }
`);
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/lib/map-graphql.ts
git commit -m "feat: Add map GraphQL query documents"
```

---

## Task 2: 创建 components/map-sdk-loader.ts

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\components\map-sdk-loader.ts`

- [ ] **Step 1: 创建 map-sdk-loader.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\dashboard\components\map-sdk-loader.ts
// 单例模式，避免重复加载
let sdkPromise: Promise<any> | null = null;

export async function loadMapSdk(sdkUrl: string): Promise<any> {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        script.onload = () => {
            const AMap = (window as any).AMap;
            if (AMap) {
                resolve(AMap);
            } else {
                reject(new Error('高德 SDK 加载完成但 window.AMap 未定义'));
            }
        };
        script.onerror = () => {
            sdkPromise = null; // 允许重试
            reject(new Error('高德 SDK 加载失败'));
        };
        document.head.appendChild(script);
    });
    return sdkPromise;
}

export function resetSdkLoader(): void {
    sdkPromise = null;
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/map-sdk-loader.ts
git commit -m "feat: Add map SDK loader singleton"
```

---

## Task 3: 创建 components/region-cascade-selector.tsx

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx`

- [ ] **Step 1: 创建 region-cascade-selector.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getMapDistricts } from '../lib/map-graphql';

export interface RegionValue {
    province: string;
    city: string;
    district: string;
    street: string;
}

interface RegionCascadeSelectorProps {
    value: RegionValue;
    onChange: (value: RegionValue) => void;
    hasConfigured: boolean;
}

interface DistrictNode {
    adcode: string;
    name: string;
    level: string;
}

export function RegionCascadeSelector({ value, onChange, hasConfigured }: RegionCascadeSelectorProps) {
    const [selectedAdcodes, setSelectedAdcodes] = useState<{
        province?: string;
        city?: string;
        district?: string;
        street?: string;
    }>({});

    // 拉省级列表
    const provincesQuery = useQuery({
        queryKey: ['mapDistricts', null],
        queryFn: () => api.query(getMapDistricts, { parentAdcode: null }),
        enabled: hasConfigured,
        retry: false,
    });

    // 拉市级列表
    const citiesQuery = useQuery({
        queryKey: ['mapDistricts', selectedAdcodes.province],
        queryFn: () => api.query(getMapDistricts, { parentAdcode: selectedAdcodes.province! }),
        enabled: hasConfigured && !!selectedAdcodes.province,
        retry: false,
    });

    // 拉区级列表
    const districtsQuery = useQuery({
        queryKey: ['mapDistricts', selectedAdcodes.city],
        queryFn: () => api.query(getMapDistricts, { parentAdcode: selectedAdcodes.city! }),
        enabled: hasConfigured && !!selectedAdcodes.city,
        retry: false,
    });

    // 拉街道级列表
    const streetsQuery = useQuery({
        queryKey: ['mapDistricts', selectedAdcodes.district],
        queryFn: () => api.query(getMapDistricts, { parentAdcode: selectedAdcodes.district! }),
        enabled: hasConfigured && !!selectedAdcodes.district,
        retry: false,
    });

    // 回显：根据 value.name 逐级匹配 adcode
    useEffect(() => {
        if (!provincesQuery.data) return;
        const provinces = provincesQuery.data.mapDistricts as DistrictNode[];
        const matchedProvince = provinces.find(p => p.name === value.province);
        if (matchedProvince && !selectedAdcodes.province) {
            setSelectedAdcodes(prev => ({ ...prev, province: matchedProvince.adcode }));
        }
    }, [provincesQuery.data, value.province]);

    useEffect(() => {
        if (!citiesQuery.data || !value.city) return;
        const cities = citiesQuery.data.mapDistricts as DistrictNode[];
        const matched = cities.find(c => c.name === value.city);
        if (matched && !selectedAdcodes.city) {
            setSelectedAdcodes(prev => ({ ...prev, city: matched.adcode }));
        }
    }, [citiesQuery.data, value.city]);

    useEffect(() => {
        if (!districtsQuery.data || !value.district) return;
        const districts = districtsQuery.data.mapDistricts as DistrictNode[];
        const matched = districts.find(d => d.name === value.district);
        if (matched && !selectedAdcodes.district) {
            setSelectedAdcodes(prev => ({ ...prev, district: matched.adcode }));
        }
    }, [districtsQuery.data, value.district]);

    if (!hasConfigured) {
        return (
            <div className="col-span-2 p-4 border rounded bg-muted/30 text-sm text-muted-foreground">
                <Trans>行政区划数据不可用（地图服务未配置），请手动在下方详细地址输入完整地址</Trans>
            </div>
        );
    }

    const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (provincesQuery.data?.mapDistricts as DistrictNode[])?.find(p => p.adcode === adcode);
        setSelectedAdcodes({ province: adcode });
        onChange({ province: node?.name ?? '', city: '', district: '', street: '' });
    };

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (citiesQuery.data?.mapDistricts as DistrictNode[])?.find(c => c.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: adcode, district: undefined, street: undefined }));
        onChange({ province: value.province, city: node?.name ?? '', district: '', street: '' });
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (districtsQuery.data?.mapDistricts as DistrictNode[])?.find(d => d.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: prev.city, district: adcode, street: undefined }));
        onChange({ province: value.province, city: value.city, district: node?.name ?? '', street: '' });
    };

    const handleStreetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (streetsQuery.data?.mapDistricts as DistrictNode[])?.find(s => s.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, ...prev, street: adcode }));
        onChange({ province: value.province, city: value.city, district: value.district, street: node?.name ?? '' });
    };

    return (
        <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            <SelectField
                label={<Trans>省</Trans>}
                value={selectedAdcodes.province ?? ''}
                onChange={handleProvinceChange}
                options={provincesQuery.data?.mapDistricts as DistrictNode[] | undefined}
                loading={provincesQuery.isLoading}
                error={provincesQuery.isError}
                onRetry={() => provincesQuery.refetch()}
            />
            <SelectField
                label={<Trans>市</Trans>}
                value={selectedAdcodes.city ?? ''}
                onChange={handleCityChange}
                options={citiesQuery.data?.mapDistricts as DistrictNode[] | undefined}
                loading={citiesQuery.isLoading}
                error={citiesQuery.isError}
                onRetry={() => citiesQuery.refetch()}
                disabled={!selectedAdcodes.province}
            />
            <SelectField
                label={<Trans>区/县</Trans>}
                value={selectedAdcodes.district ?? ''}
                onChange={handleDistrictChange}
                options={districtsQuery.data?.mapDistricts as DistrictNode[] | undefined}
                loading={districtsQuery.isLoading}
                error={districtsQuery.isError}
                onRetry={() => districtsQuery.refetch()}
                disabled={!selectedAdcodes.city}
            />
            <SelectField
                label={<Trans>街道</Trans>}
                value={selectedAdcodes.street ?? ''}
                onChange={handleStreetChange}
                options={streetsQuery.data?.mapDistricts as DistrictNode[] | undefined}
                loading={streetsQuery.isLoading}
                error={streetsQuery.isError}
                onRetry={() => streetsQuery.refetch()}
                disabled={!selectedAdcodes.district}
            />
        </div>
    );
}

function SelectField({
    label, value, onChange, options, loading, error, onRetry, disabled,
}: {
    label: React.ReactNode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options?: DistrictNode[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    disabled?: boolean;
}) {
    return (
        <div>
            <label className="text-sm font-medium mb-1 block">{label}</label>
            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> <Trans>加载中</Trans>
                </div>
            ) : error ? (
                <button onClick={onRetry} className="flex items-center gap-2 text-sm text-destructive">
                    <RefreshCw className="h-4 w-4" /> <Trans>加载失败，点击重试</Trans>
                </button>
            ) : (
                <select
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-muted/30"
                >
                    <option value="">{<Trans>请选择</Trans>}{label}</option>
                    {options?.map(o => (
                        <option key={o.adcode} value={o.adcode}>{o.name}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/region-cascade-selector.tsx
git commit -m "feat: Add RegionCascadeSelector with 4-level cascade"
```

---

## Task 4: 创建 components/map-picker.tsx

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx`

- [ ] **Step 1: 创建 map-picker.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx
import { useQuery } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getMapSdkConfig, reverseGeocode } from '../lib/map-graphql';
import { loadMapSdk } from './map-sdk-loader';

interface MapPickerProps {
    value: { lat: number; lng: number } | null;
    onChange: (value: { lat: number; lng: number } | null) => void;
    onReverseGeocode?: (result: {
        province: string | null;
        city: string | null;
        district: string | null;
        street: string | null;
    }) => void;
}

export function MapPicker({ value, onChange, onReverseGeocode }: MapPickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const [sdkError, setSdkError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const sdkConfigQuery = useQuery({
        queryKey: ['mapSdkConfig'],
        queryFn: () => api.query(getMapSdkConfig, undefined),
        retry: 3,
    });

    // 加载 SDK
    useEffect(() => {
        if (!sdkConfigQuery.data) return;
        const cfg = sdkConfigQuery.data.mapSdkConfig;
        if (!cfg.hasConfigured) {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadMapSdk(cfg.sdkUrl)
            .then(() => {
                setSdkError(null);
                setLoading(false);
            })
            .catch(err => {
                setSdkError(err.message);
                setLoading(false);
            });
    }, [sdkConfigQuery.data]);

    // 初始化地图
    useEffect(() => {
        if (loading || sdkError) return;
        const AMap = (window as any).AMap;
        if (!AMap || !containerRef.current) return;
        if (mapRef.current) return; // 已初始化

        const center: [number, number] = value
            ? [value.lng, value.lat]
            : [116.397428, 39.90923]; // 北京天安门默认

        mapRef.current = new AMap.Map(containerRef.current, {
            zoom: 15,
            center,
        });

        if (value) {
            markerRef.current = new AMap.Marker({
                position: [value.lng, value.lat],
                map: mapRef.current,
            });
        }

        mapRef.current.on('click', (e: any) => {
            const lng = e.lnglat.getLng();
            const lat = e.lnglat.getLat();
            handleSelectLocation(lat, lng);
        });

        return () => {
            mapRef.current?.destroy?.();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, [loading, sdkError]);

    const handleSelectLocation = async (lat: number, lng: number) => {
        const AMap = (window as any).AMap;
        if (!mapRef.current) return;

        // 更新标记
        if (markerRef.current) {
            markerRef.current.setPosition([lng, lat]);
        } else {
            markerRef.current = new AMap.Marker({
                position: [lng, lat],
                map: mapRef.current,
            });
        }

        onChange({ lat, lng });

        // 逆地理编码
        try {
            const result = await api.query(reverseGeocode, { lat, lng });
            const addr = result.reverseGeocode;
            onReverseGeocode?.({
                province: addr.province,
                city: addr.city,
                district: addr.district,
                street: addr.street,
            });
        } catch (err: any) {
            toast.error('逆地理编码失败: ' + (err?.message ?? '未知错误'));
        }
    };

    const handleClear = () => {
        if (markerRef.current) {
            markerRef.current.setMap(null);
            markerRef.current = null;
        }
        onChange(null);
    };

    if (sdkConfigQuery.isLoading) {
        return <div className="h-[400px] flex items-center justify-center border rounded"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (sdkConfigQuery.isError) {
        return (
            <div className="h-[400px] flex items-center justify-center border rounded text-destructive">
                <Trans>地图配置加载失败，请刷新页面</Trans>
            </div>
        );
    }

    const cfg = sdkConfigQuery.data?.mapSdkConfig;
    if (!cfg?.hasConfigured) {
        return (
            <div className="h-[400px] flex items-center justify-center border rounded bg-muted/30 text-sm text-muted-foreground text-center px-4">
                <Trans>地图功能未配置，请联系管理员在后台 Channel 配置 mapConfig。您可以手动在下方经纬度字段填写坐标。</Trans>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-[400px] flex items-center justify-center border rounded gap-2">
                <Loader2 className="h-6 w-6 animate-spin" /> <Trans>地图加载中</Trans>
            </div>
        );
    }

    if (sdkError) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center border rounded text-destructive gap-2">
                <span><Trans>地图加载失败</Trans>：{sdkError}</span>
                <button onClick={() => { setSdkError(null); setLoading(true); }} className="px-3 py-1 border rounded">
                    <Trans>重试</Trans>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><Trans>点击地图选择位置</Trans></span>
                {value && (
                    <button onClick={handleClear} className="flex items-center gap-1 text-sm text-destructive">
                        <X className="h-4 w-4" /> <Trans>清除选点</Trans>
                    </button>
                )}
            </div>
            <div ref={containerRef} className="h-[400px] w-full border rounded" />
            {value && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <Trans>经度</Trans>: {value.lng.toFixed(6)}, <Trans>纬度</Trans>: {value.lat.toFixed(6)}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/map-picker.tsx
git commit -m "feat: Add MapPicker component with amap integration"
```

---

## Task 5: 重写 pickup-location-detail.tsx

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-detail.tsx`

- [ ] **Step 1: 用完整新内容覆盖 pickup-location-detail.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-detail.tsx
import { graphql } from '@/graphql/graphql';
import {
    BooleanInput,
    Button,
    DashboardRouteDefinition,
    DetailFormGrid,
    detailPageRouteLoader,
    FormFieldWrapper,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageBlock,
    PageLayout,
    PageTitle,
    SelectWithOptions,
    TextInput,
    toast,
    useDetailPage,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { MapPicker } from './components/map-picker';
import { RegionCascadeSelector, RegionValue } from './components/region-cascade-selector';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { getMapSdkConfig } from './lib/map-graphql';

const getPickupLocationDetail = graphql(`
    query GetPickupLocationDetail($id: ID!) {
        pickupLocation(id: $id) {
            id
            name
            type
            address
            phoneNumber
            businessHours
            coordinates
            partner
            isPublic
            province
            city
            district
            street
        }
    }
`);

const createPickupLocation = graphql(`
    mutation CreatePickupLocation($input: CreatePickupLocationInput!) {
        createPickupLocation(input: $input) {
            id
            name
        }
    }
`);

const updatePickupLocation = graphql(`
    mutation UpdatePickupLocation($input: UpdatePickupLocationInput!) {
        updatePickupLocation(input: $input) {
            id
            name
        }
    }
`);

export const pickupLocationDetail: DashboardRouteDefinition = {
    path: '/pickup-locations/$id',
    loader: detailPageRouteLoader({
        queryDocument: getPickupLocationDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/pickup-locations', label: '自提点管理' },
            isNew ? '新建' : (entity as any)?.name ?? '详情',
        ],
    }),
    component: route => <PickupLocationDetailPage route={route} />,
};

function PickupLocationDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const navigate = useNavigate();

    const { form, submitHandler, entity, isPending } = useDetailPage<any, any, any>({
        queryDocument: getPickupLocationDetail,
        createDocument: createPickupLocation,
        updateDocument: updatePickupLocation,
        params: { id: params.id },
        setValuesForUpdate: (loc: any) => ({
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
            isPublic: loc.isPublic,
        }),
        onSuccess: async (data: any) => {
            toast.success(entity ? '更新成功' : '创建成功');
            if (!entity && data.id) {
                await navigate({ to: '../$id', params: { id: data.id } });
            }
        },
        onError: (err: any) => {
            toast.error('保存失败: ' + (err?.message ?? '未知错误'));
        },
    });

    // 查询地图配置（用于降级判断）
    const sdkConfigQuery = useQuery({
        queryKey: ['mapSdkConfig'],
        queryFn: () => api.query(getMapSdkConfig, undefined),
        retry: 3,
    });
    const hasMapConfigured = sdkConfigQuery.data?.mapSdkConfig?.hasConfigured ?? false;

    // 监听省市区街道变化，自动拼接 address
    const province = form.watch('province');
    const city = form.watch('city');
    const district = form.watch('district');
    const street = form.watch('street');
    const detailAddr = form.watch('address');

    useEffect(() => {
        const regionPart = [province, city, district, street].filter(Boolean).join('');
        if (regionPart) {
            const fullAddress = regionPart + (detailAddr ?? '');
            form.setValue('address', fullAddress, { shouldDirty: true });
        }
    }, [province, city, district, street]);

    const handleRegionChange = (val: RegionValue) => {
        form.setValue('province', val.province || null, { shouldDirty: true });
        form.setValue('city', val.city || null, { shouldDirty: true });
        form.setValue('district', val.district || null, { shouldDirty: true });
        form.setValue('street', val.street || null, { shouldDirty: true });
    };

    const handleReverseGeocode = (result: {
        province: string | null;
        city: string | null;
        district: string | null;
        street: string | null;
    }) => {
        if (result.province) form.setValue('province', result.province, { shouldDirty: true });
        if (result.city) form.setValue('city', result.city, { shouldDirty: true });
        if (result.district) form.setValue('district', result.district, { shouldDirty: true });
        if (result.street) form.setValue('street', result.street, { shouldDirty: true });
    };

    return (
        <Page pageId="pickup-location-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{entity?.name ?? <Trans>新建自提点</Trans>}</PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button type="submit" disabled={!form.formState.isDirty || isPending}>
                        {entity ? <Trans>保存</Trans> : <Trans>创建</Trans>}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="main" blockId="basic-info">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="name"
                            label={<Trans>名称</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="如：双阳商城店" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="type"
                            label={<Trans>类型</Trans>}
                            render={({ field }) => (
                                <SelectWithOptions
                                    {...field}
                                    fieldDef={{
                                        type: 'string',
                                        name: 'type',
                                        options: [
                                            { value: 'store', label: '门店' },
                                            { value: 'point', label: '驿站' },
                                            { value: 'employee', label: '员工自提点' },
                                        ],
                                    }}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="phoneNumber"
                            label={<Trans>电话</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="如：0431-84221001" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="businessHours"
                            label={<Trans>营业时间</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="如：09:00-22:00" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="partner"
                            label={<Trans>合作方</Trans>}
                            render={({ field }) => <TextInput {...field} />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="isPublic"
                            label={<Trans>是否公开</Trans>}
                            render={({ field }) => <BooleanInput {...field} />}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="region-address">
                    <DetailFormGrid>
                        <Controller
                            control={form.control}
                            name="province"
                            render={({ field }) => (
                                <RegionCascadeSelector
                                    value={{
                                        province: field.value ?? '',
                                        city: form.watch('city') ?? '',
                                        district: form.watch('district') ?? '',
                                        street: form.watch('street') ?? '',
                                    }}
                                    onChange={handleRegionChange}
                                    hasConfigured={hasMapConfigured}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="address"
                            label={<Trans>详细地址</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="门牌号，如：西双阳大街188号" />}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="map-picker">
                    <Controller
                        control={form.control}
                        name="coordinates"
                        render={({ field }) => (
                            <MapPicker
                                value={field.value}
                                onChange={field.onChange}
                                onReverseGeocode={handleReverseGeocode}
                            />
                        )}
                    />
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
```

**注意**：`<option>` 标签内的文本（如"门店/驿站/员工自提点"）和 `<Trans>` 在 `<option>` 内的支持有限，所以 SelectWithOptions 的 options label 硬编码中文。这是已知限制，因为 native `<option>` 不支持 React 子组件。

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/pickup-location-detail.tsx
git commit -m "feat: Rewrite pickup location detail page with map picker and region cascade"
```

---

## Task 6: 修改 pickup-location-list.tsx 中文化

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx`

- [ ] **Step 1: 读取当前 pickup-location-list.tsx**

Run: `Read e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx`

- [ ] **Step 2: 修改列标题为中文（用 Trans 包裹）**

将 `customizeColumns` 中的 `header` 字段改为 JSX（用 `<Trans>` 包裹）。注意：header 接受 `string | ReactNode`，可放 JSX。

- `id` 的 `header: 'ID'` 保持
- `name` 的 `header: 'Name'` → `header: <Trans>名称</Trans>`
- `type` 的 `header: 'Type'` → `header: <Trans>类型</Trans>`（如果存在 type 列）
- `address` 的 `header: 'Address'` → `header: <Trans>地址</Trans>`（如果存在）
- `actions` 的 `header: '操作'` → `header: <Trans>操作</Trans>`

需要在文件顶部追加 `import { Trans } from '@lingui/react/macro';`（如果未导入）。

- [ ] **Step 3: type 列显示中文映射**

在 `customizeColumns.type`（如果存在）的 cell 函数中加映射：

```tsx
type: {
    header: <Trans>类型</Trans>,
    cell: ({ row }) => {
        const typeMap: Record<string, string> = {
            store: '门店',
            point: '驿站',
            employee: '员工自提点',
        };
        return <DetailPageButton id={row.original.id} label={typeMap[row.original.type] ?? row.original.type} />;
    },
},
```

如果 type 列不存在，在 customizeColumns 中追加。

- [ ] **Step 4: 修改页面标题为中文**

将 `title={<Trans>Pickup Locations</Trans>}` 改为 `title={<Trans>自提点管理</Trans>}`

同时修改 `navMenuItem.title: 'Pickup Locations'` → `navMenuItem.title: '自提点管理'`（navMenuItem.title 是 string 类型，不能用 Trans，直接硬编码中文）。

修改 `loader: () => ({ breadcrumb: 'Pickup Locations' })` → `breadcrumb: '自提点管理'`。

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/pickup-location-list.tsx
git commit -m "feat: Localize pickup location list to Chinese"
```

---

## Task 7: 浏览器验证

**Files:**
- 无文件改动，仅测试验证

- [ ] **Step 1: 确保 dev server 运行**

后端 dev server（端口 3000）和 dashboard dev server（端口 5173）都应运行。如未运行：

```bash
cd e:\code\vendure\packages\dev-server && npm run dev
# 另一个终端
cd e:\code\vendure\packages\dev-server && npm run dashboard:dev
```

- [ ] **Step 2: 访问列表页验证中文化**

访问 `http://localhost:5173/dashboard/pickup-locations`

Expected:
- 页面标题"自提点管理"
- 列标题为中文（名称/类型/地址/操作）
- type 列显示中文（门店/驿站/员工自提点）

- [ ] **Step 3: 点击"新建自提点"进入新建页**

Expected:
- 标题显示"新建自提点"
- 表单 label 全中文（名称/类型/电话/营业时间/合作方/是否公开/详细地址）
- 类型字段是下拉选择（门店/驿站/员工自提点）
- 是否公开字段是 checkbox
- 省市区街道 4 个级联下拉
- 地图区域（如果已配置 mapConfig）

- [ ] **Step 4: 验证地图选点（需先配置 mapConfig）**

如已配置真实高德 key：
1. 点击地图任意位置
2. 验证标记点出现
3. 验证省市区街道自动回填
4. 验证详细地址自动拼接

- [ ] **Step 5: 验证级联选择**

1. 选省（如：吉林省）
2. 验证市级列表加载
3. 选市（如：长春市）
4. 验证区级列表加载
5. 选区（如：双阳区）
6. 验证街道级列表加载
7. 验证详细地址字段自动拼接为"吉林省长春市双阳区..."

- [ ] **Step 6: 验证创建**

1. 填写名称：测试自提点
2. 选类型：门店
3. 选省市区街道
4. 填详细地址
5. 点击"创建"
6. 验证 toast"创建成功"
7. 验证跳转到详情页

- [ ] **Step 7: 验证编辑回显**

1. 访问已有自提点详情页（如 id=1）
2. 验证所有字段正确回显
3. 验证省市区街道级联回显正确选中
4. 验证地图标记点显示

- [ ] **Step 8: 验证 MapConfig 未配置时的降级**

1. 通过 admin-api 清空默认 Channel 的 mapConfig（或用未配置的 Channel）
2. 访问新建页
3. 验证地图区域显示"地图功能未配置"提示
4. 验证级联选择器显示"行政区划数据不可用"提示
5. 验证仍可手动填写并提交

---

## Self-Review

### Spec coverage
- ✅ 全中文 UI → Task 5 + Task 6
- ✅ type 改下拉选择 → Task 5 Step 1 的 SelectWithOptions
- ✅ coordinates 通过地图选点录入 → Task 4 + Task 5
- ✅ 省市区街道四级联动选择 → Task 3 + Task 5
- ✅ 地图服务商抽象层（后端 plan 已覆盖）
- ✅ 地图 API key 在后台 Channel 配置存储（后端 plan 已覆盖）
- ✅ 旧数据复用（address 保留，省市区街道字段为空时降级）→ Task 5 的 useEffect 拼接逻辑 + Task 3 的回显逻辑
- ✅ MapConfig 未配置时的降级 → Task 4 + Task 3 的 hasConfigured 检查

### Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 所有代码完整
- ✅ 所有命令完整

### Type consistency
- ✅ `RegionValue` 接口在 Task 3 定义，Task 5 使用
- ✅ `MapPickerProps` 在 Task 4 定义，Task 5 使用
- ✅ `getMapSdkConfig/getMapDistricts/reverseGeocode` 在 Task 1 定义，Task 3/4/5 使用
- ✅ `loadMapSdk` 在 Task 2 定义，Task 4 使用
- ✅ GraphQL mutation `createPickupLocation` 返回 `{id, name}`（Task 5），与 useDetailPage onSuccess 用 `data.id` 一致
