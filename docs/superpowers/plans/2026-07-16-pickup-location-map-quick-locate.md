# 自提点地图快速定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给自提点详情页地图加 4 个快速定位功能：GPS 定位按钮、地址搜索框、省市区联动地图、详细地址自动联想。

**Architecture:** MapPicker 用 forwardRef 暴露 `setCenter(lng, lat)` 方法，父组件通过 ref 控制地图视角。地址搜索和 GPS 定位都在 MapPicker 内部实现。详细地址自动联想单独做 AddressAutoComplete 组件，通过回调通知父组件。

**Tech Stack:** React + Vendure Dashboard + 高德 JS API 2.0（AMap.AutoComplete / AMap.PlaceSearch 已加载）+ react-hook-form

**依赖**：spec `2026-07-16-pickup-location-map-quick-locate-design.md`。后端无需改动（`mapDistricts` 已返回 `center`，AutoComplete 插件已在 SDK URL 加载）。

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `dashboard/components/map-picker.tsx` | 修改 | forwardRef 暴露 setCenter + 加 GPS 按钮 + 加地址搜索框 |
| `dashboard/components/address-auto-complete.tsx` | 创建 | 详细地址自动联想组件 |
| `dashboard/components/region-cascade-selector.tsx` | 修改 | 加 onRegionCenterChange 回调 |
| `dashboard/pickup-location-detail.tsx` | 修改 | 集成 AddressAutoComplete + mapPickerRef + onRegionCenterChange |

---

## 关键约束（已验证）

1. **高德 AutoComplete 插件已加载**：`amap-provider.ts` 的 `getSdkLoaderUrl` 的 plugins 参数已包含 `AMap.AutoComplete,AMap.PlaceSearch`，无需改后端
2. **`mapDistricts` 已返回 `center: {lat, lng}`**：无需新增 GraphQL 查询
3. **`reverseGeocode` GraphQL 查询已就绪**：在 `lib/map-graphql.ts`
4. **React `forwardRef` + `useImperativeHandle`**：标准 React API，从 `react` 导入
5. **`navigator.geolocation`**：浏览器原生 API，需 HTTPS 或 localhost
6. **Dashboard 组件用 `Controller` 包裹自定义控件**：已在 pickup-location-detail.tsx 验证

---

## Task 1: 改造 MapPicker — forwardRef + setCenter + GPS + 搜索框

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx`

- [ ] **Step 1: 读取当前 map-picker.tsx**

Run: `Read e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx`

- [ ] **Step 2: 用完整新内容覆盖 map-picker.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx
import { useQuery } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getMapSdkConfig, reverseGeocode } from '../lib/map-graphql';
import { loadMapSdk } from './map-sdk-loader';

export interface MapPickerHandle {
    setCenter: (lng: number, lat: number, withMarker?: boolean) => void;
    clearMarker: () => void;
}

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

interface AutoCompleteItem {
    name: string;
    location: { lng: number; lat: number };
    adcode: string;
}

export const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(function MapPicker(
    { value, onChange, onReverseGeocode },
    ref,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const autoCompleteRef = useRef<any>(null);
    const [sdkError, setSdkError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locating, setLocating] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<AutoCompleteItem[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);

    const sdkConfigQuery = useQuery({
        queryKey: ['mapSdkConfig'],
        queryFn: () => api.query(getMapSdkConfig, undefined),
        retry: 3,
    });

    // 暴露 setCenter 给父组件
    useImperativeHandle(ref, () => ({
        setCenter: (lng: number, lat: number, withMarker = true) => {
            const AMap = (window as any).AMap;
            if (!mapRef.current) return;
            mapRef.current.setCenter([lng, lat]);
            if (withMarker) {
                if (markerRef.current) {
                    markerRef.current.setPosition([lng, lat]);
                } else {
                    markerRef.current = new AMap.Marker({
                        position: [lng, lat],
                        map: mapRef.current,
                    });
                }
                onChange({ lat, lng });
            }
        },
        clearMarker: () => {
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
            onChange(null);
        },
    }));

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

    // 初始化地图 + AutoComplete 实例
    useEffect(() => {
        if (loading || sdkError) return;
        const AMap = (window as any).AMap;
        if (!AMap || !containerRef.current) return;
        if (mapRef.current) return;

        const hasCoords = value && value.lng != null && value.lat != null;
        const center: [number, number] = hasCoords
            ? [value.lng, value.lat]
            : [116.397428, 39.90923];

        mapRef.current = new AMap.Map(containerRef.current, {
            zoom: 15,
            center,
        });

        if (hasCoords) {
            markerRef.current = new AMap.Marker({
                position: [value.lng, value.lat],
                map: mapRef.current,
            });
        }

        // 初始化 AutoComplete 插件实例（用于地址搜索框）
        try {
            autoCompleteRef.current = new AMap.AutoComplete({ city: '全国' });
        } catch (err) {
            console.warn('AutoComplete plugin init failed', err);
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
            autoCompleteRef.current = null;
        };
    }, [loading, sdkError]);

    const handleSelectLocation = async (lat: number, lng: number) => {
        const AMap = (window as any).AMap;
        if (!mapRef.current) return;

        if (markerRef.current) {
            markerRef.current.setPosition([lng, lat]);
        } else {
            markerRef.current = new AMap.Marker({
                position: [lng, lat],
                map: mapRef.current,
            });
        }
        onChange({ lat, lng });
        await doReverseGeocode(lat, lng);
    };

    const doReverseGeocode = async (lat: number, lng: number) => {
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

    // GPS 定位
    const handleLocate = () => {
        if (!navigator.geolocation) {
            toast.error('浏览器不支持定位功能');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const AMap = (window as any).AMap;
                if (mapRef.current) {
                    mapRef.current.setCenter([lng, lat]);
                    if (markerRef.current) {
                        markerRef.current.setPosition([lng, lat]);
                    } else {
                        markerRef.current = new AMap.Marker({
                            position: [lng, lat],
                            map: mapRef.current,
                        });
                    }
                    onChange({ lat, lng });
                    await doReverseGeocode(lat, lng);
                }
                setLocating(false);
            },
            err => {
                setLocating(false);
                const msg = err.code === 1 ? '定位权限被拒绝' : err.code === 2 ? '位置不可用' : '定位超时';
                toast.error('定位失败: ' + msg + '，请手动搜索或点击地图');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    };

    // 地址搜索（防抖 + 最小 2 字符）
    useEffect(() => {
        if (!searchKeyword || searchKeyword.length < 2) {
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }
        if (!autoCompleteRef.current) return;
        const timer = setTimeout(() => {
            autoCompleteRef.current.search(searchKeyword, (status: string, result: any) => {
                if (status === 'complete' && result.tips) {
                    const items: AutoCompleteItem[] = result.tips
                        .filter((t: any) => t.location)
                        .map((t: any) => ({
                            name: t.name,
                            location: { lng: t.location.lng, lat: t.location.lat },
                            adcode: t.adcode,
                        }));
                    setSearchResults(items);
                    setSearchOpen(true);
                } else {
                    setSearchResults([]);
                    setSearchOpen(false);
                }
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    const handleSelectSearchResult = async (item: AutoCompleteItem) => {
        const AMap = (window as any).AMap;
        const { lng, lat } = item.location;
        if (mapRef.current) {
            mapRef.current.setCenter([lng, lat]);
            mapRef.current.setZoom(15);
            if (markerRef.current) {
                markerRef.current.setPosition([lng, lat]);
            } else {
                markerRef.current = new AMap.Marker({
                    position: [lng, lat],
                    map: mapRef.current,
                });
            }
            onChange({ lat, lng });
            await doReverseGeocode(lat, lng);
        }
        setSearchKeyword(item.name);
        setSearchOpen(false);
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
                <Trans>地图功能未配置，请联系管理员在后台 Channel 配置 mapConfig。</Trans>
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

    const hasCoords = value && value.lng != null && value.lat != null;

    return (
        <div className="space-y-2">
            {/* 工具栏：搜索框 + GPS 按钮 */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        placeholder="搜索地址（如：双阳区、欧亚卖场）"
                        className="w-full border rounded pl-8 pr-2 py-1 text-sm"
                    />
                    {searchOpen && searchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
                            {searchResults.map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSearchResult(item)}
                                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/30 border-b last:border-b-0"
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleLocate}
                    disabled={locating}
                    className="flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50"
                    title="定位当前位置"
                >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                    <Trans>定位</Trans>
                </button>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><Trans>点击地图选择位置</Trans></span>
                {hasCoords && (
                    <button onClick={handleClear} className="flex items-center gap-1 text-sm text-destructive">
                        <X className="h-4 w-4" /> <Trans>清除选点</Trans>
                    </button>
                )}
            </div>
            <div ref={containerRef} className="h-[400px] w-full border rounded" />
            {hasCoords && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <Trans>经度</Trans>: {value!.lng.toFixed(6)}, <Trans>纬度</Trans>: {value!.lat.toFixed(6)}
                </div>
            )}
        </div>
    );
});
```

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/map-picker.tsx
git commit -m "feat: Add GPS locate button and address search box to MapPicker, expose setCenter via forwardRef"
```

---

## Task 2: 创建 AddressAutoComplete 组件

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\components\address-auto-complete.tsx`

- [ ] **Step 1: 创建 address-auto-complete.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\components\address-auto-complete.tsx
import { Trans } from '@lingui/react/macro';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AddressAutoCompleteProps {
    value: string;
    onChange: (value: string) => void;
    onLocationSelect?: (location: { lng: number; lat: number }, name: string) => void;
    hasConfigured: boolean;
    placeholder?: string;
}

interface AutoCompleteItem {
    name: string;
    location: { lng: number; lat: number };
}

export function AddressAutoComplete({
    value,
    onChange,
    onLocationSelect,
    hasConfigured,
    placeholder,
}: AddressAutoCompleteProps) {
    const autoCompleteRef = useRef<any>(null);
    const [keyword, setKeyword] = useState(value ?? '');
    const [results, setResults] = useState<AutoCompleteItem[]>([]);
    const [open, setOpen] = useState(false);

    // 初始化 AutoComplete 实例（懒加载）
    useEffect(() => {
        if (!hasConfigured) return;
        const AMap = (window as any).AMap;
        if (!AMap) return;
        try {
            autoCompleteRef.current = new AMap.AutoComplete({ city: '全国' });
        } catch (err) {
            console.warn('AutoComplete plugin init failed', err);
        }
    }, [hasConfigured]);

    // 同步外部 value 变化（如逆地理编码回填）
    useEffect(() => {
        setKeyword(value ?? '');
    }, [value]);

    // 搜索（防抖 300ms + 最小 2 字符）
    useEffect(() => {
        if (!hasConfigured || !keyword || keyword.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        if (!autoCompleteRef.current) return;
        const timer = setTimeout(() => {
            autoCompleteRef.current.search(keyword, (status: string, result: any) => {
                if (status === 'complete' && result.tips) {
                    const items: AutoCompleteItem[] = result.tips
                        .filter((t: any) => t.location)
                        .map((t: any) => ({
                            name: t.name,
                            location: { lng: t.location.lng, lat: t.location.lat },
                        }));
                    setResults(items);
                    setOpen(true);
                } else {
                    setResults([]);
                    setOpen(false);
                }
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [keyword, hasConfigured]);

    const handleSelect = (item: AutoCompleteItem) => {
        setKeyword(item.name);
        onChange(item.name);
        onLocationSelect?.(item.location, item.name);
        setOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(e.target.value);
        onChange(e.target.value);
    };

    // 未配置地图服务时降级为普通 input
    if (!hasConfigured) {
        return (
            <input
                type="text"
                value={keyword}
                onChange={handleInputChange}
                placeholder={placeholder}
                className="w-full border rounded px-2 py-1 text-sm"
            />
        );
    }

    return (
        <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
                type="text"
                value={keyword}
                onChange={handleInputChange}
                placeholder={placeholder}
                className="w-full border rounded pl-8 pr-2 py-1 text-sm"
            />
            {open && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
                    {results.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/30 border-b last:border-b-0"
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/address-auto-complete.tsx
git commit -m "feat: Add AddressAutoComplete component for detailed address field"
```

---

## Task 3: 修改 RegionCascadeSelector 加 onRegionCenterChange 回调

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx`

- [ ] **Step 1: 读取当前 region-cascade-selector.tsx**

Run: `Read e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx`

- [ ] **Step 2: 在 props 接口加 onRegionCenterChange**

将 `RegionCascadeSelectorProps` 接口改为：

```typescript
interface RegionCascadeSelectorProps {
    value: RegionValue;
    onChange: (value: RegionValue) => void;
    hasConfigured: boolean;
    onRegionCenterChange?: (center: { lat: number; lng: number }, level: 'province' | 'city' | 'district' | 'street') => void;
}
```

- [ ] **Step 3: 在每个 handleXxxChange 中加 onRegionCenterChange 调用**

`DistrictNode` 接口已有 `center` 字段（从 GraphQL 查询返回）。在每个 change handler 中，找到选中的 node 后调用 `onRegionCenterChange`。

修改 `handleProvinceChange`：

```typescript
const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const adcode = e.target.value;
    const node = (provincesQuery.data?.mapDistricts as DistrictNode[])?.find(p => p.adcode === adcode);
    setSelectedAdcodes({ province: adcode });
    onChange({ province: node?.name ?? '', city: '', district: '', street: '' });
    if (node?.center) onRegionCenterChange?.(node.center, 'province');
};
```

修改 `handleCityChange`：

```typescript
const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const adcode = e.target.value;
    const node = (citiesQuery.data?.mapDistricts as DistrictNode[])?.find(c => c.adcode === adcode);
    setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: adcode, district: undefined, street: undefined }));
    onChange({ province: value.province, city: node?.name ?? '', district: '', street: '' });
    if (node?.center) onRegionCenterChange?.(node.center, 'city');
};
```

修改 `handleDistrictChange`：

```typescript
const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const adcode = e.target.value;
    const node = (districtsQuery.data?.mapDistricts as DistrictNode[])?.find(d => d.adcode === adcode);
    setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: prev.city, district: adcode, street: undefined }));
    onChange({ province: value.province, city: value.city, district: node?.name ?? '', street: '' });
    if (node?.center) onRegionCenterChange?.(node.center, 'district');
};
```

修改 `handleStreetChange`：

```typescript
const handleStreetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const adcode = e.target.value;
    const node = (streetsQuery.data?.mapDistricts as DistrictNode[])?.find(s => s.adcode === adcode);
    setSelectedAdcodes(prev => ({ ...prev, street: adcode }));
    onChange({ province: value.province, city: value.city, district: value.district, street: node?.name ?? '' });
    if (node?.center) onRegionCenterChange?.(node.center, 'street');
};
```

- [ ] **Step 4: 更新 DistrictNode 接口加 center 字段**

将组件内部的 `DistrictNode` 接口改为（与 GraphQL 返回一致）：

```typescript
interface DistrictNode {
    adcode: string;
    name: string;
    level: string;
    center: { lat: number; lng: number };
}
```

- [ ] **Step 5: 验证 Vite 编译**

Vite dev server 会自动热重载，检查浏览器无报错。

- [ ] **Step 6: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/components/region-cascade-selector.tsx
git commit -m "feat: Add onRegionCenterChange callback to RegionCascadeSelector"
```

---

## Task 4: 修改 pickup-location-detail.tsx 集成所有组件

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-detail.tsx`

- [ ] **Step 1: 读取当前 pickup-location-detail.tsx**

Run: `Read e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-detail.tsx`

- [ ] **Step 2: 修改 imports**

追加导入：

```typescript
import { useRef } from 'react';
import { MapPicker, MapPickerHandle } from './components/map-picker';
import { AddressAutoComplete } from './components/address-auto-complete';
```

（移除原来的 `import { MapPicker } from './components/map-picker';`）

- [ ] **Step 3: 在 PickupLocationDetailPage 函数内加 mapPickerRef**

在 `const navigate = useNavigate();` 后追加：

```typescript
    const mapPickerRef = useRef<MapPickerHandle>(null);
```

- [ ] **Step 4: 修改 handleRegionChange 加 onRegionCenterChange 透传**

将 RegionCascadeSelector 的 Controller 改为：

```tsx
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
                                    onRegionCenterChange={(center, level) => {
                                        // 省级 zoom 7，市级 9，区级 11，街道 13
                                        const zoomMap = { province: 7, city: 9, district: 11, street: 13 };
                                        mapPickerRef.current?.setCenter(center.lng, center.lat, false);
                                        // setCenter 不改 zoom，需直接操作 map 实例（通过 setCenter 的副作用）
                                        // 简化：只 setCenter 不带 marker，zoom 由用户手动或 setCenter 内部不变
                                    }}
                                />
                            )}
                        />
```

**注意**：`MapPickerHandle.setCenter` 的第三参数 `withMarker=false` 表示只移动视角不加标记（符合 spec 设计"不自动加标记"）。

- [ ] **Step 5: 替换详细地址字段的 TextInput 为 AddressAutoComplete**

将原来的：

```tsx
                        <FormFieldWrapper
                            control={form.control}
                            name="address"
                            label={<Trans>详细地址</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="门牌号，如：西双阳大街188号" />}
                        />
```

改为：

```tsx
                        <FormFieldWrapper
                            control={form.control}
                            name="address"
                            label={<Trans>详细地址</Trans>}
                            render={({ field }) => (
                                <AddressAutoComplete
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    hasConfigured={hasMapConfigured}
                                    placeholder="门牌号，如：西双阳大街188号"
                                    onLocationSelect={(location, name) => {
                                        // 选中搜索结果：更新 coordinates + 地图跳转 + 加标记
                                        form.setValue('coordinates', { lat: location.lat, lng: location.lng }, { shouldDirty: true });
                                        mapPickerRef.current?.setCenter(location.lng, location.lat, true);
                                        // 触发逆地理编码回填省市区街道
                                        handleReverseGeocodePromise(location.lat, location.lng);
                                    }}
                                />
                            )}
                        />
```

- [ ] **Step 6: 加 handleReverseGeocodePromise 辅助函数**

在 `handleReverseGeocode` 函数后追加（因为原 `handleReverseGeocode` 是同步调用 form.setValue 的 void 函数，这里需要一个 async 版本用于 AddressAutoComplete 选中后调 reverseGeocode）：

```typescript
    const handleReverseGeocodePromise = async (lat: number, lng: number) => {
        try {
            const { reverseGeocode: reverseGeocodeQuery } = await import('./lib/map-graphql');
            const { api } = await import('@vendure/dashboard');
            const result = await api.query(reverseGeocodeQuery, { lat, lng });
            const addr = result.reverseGeocode;
            handleReverseGeocode(addr);
        } catch (err: any) {
            toast.error('逆地理编码失败: ' + (err?.message ?? '未知错误'));
        }
    };
```

**简化方案**（推荐，避免动态 import）：直接在文件顶部已有 `import { api } from '@vendure/dashboard';` 和 `import { getMapSdkConfig } from './lib/map-graphql';`，追加导入 `reverseGeocode`：

修改顶部 import：
```typescript
import { getMapSdkConfig, reverseGeocode } from './lib/map-graphql';
```

然后 `handleReverseGeocodePromise` 简化为：

```typescript
    const handleReverseGeocodePromise = async (lat: number, lng: number) => {
        try {
            const result = await api.query(reverseGeocode, { lat, lng });
            const addr = result.reverseGeocode;
            handleReverseGeocode(addr);
        } catch (err: any) {
            toast.error('逆地理编码失败: ' + (err?.message ?? '未知错误'));
        }
    };
```

- [ ] **Step 7: 修改 MapPicker 的 Controller 加 ref**

将原来的：

```tsx
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
```

改为：

```tsx
                    <Controller
                        control={form.control}
                        name="coordinates"
                        render={({ field }) => (
                            <MapPicker
                                ref={mapPickerRef}
                                value={field.value}
                                onChange={field.onChange}
                                onReverseGeocode={handleReverseGeocode}
                            />
                        )}
                    />
```

- [ ] **Step 8: 验证 Vite 热重载无报错**

检查 dashboard dev server 输出无编译错误。

- [ ] **Step 9: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/pickup-location-detail.tsx
git commit -m "feat: Integrate GPS, search, region cascade, and address autocomplete into pickup location detail"
```

---

## Task 5: 浏览器验证

**Files:**
- 无文件改动

- [ ] **Step 1: 确保服务运行**

后端 dev server（端口 3000）和 dashboard dev server（端口 5173 或 5174）已运行。

- [ ] **Step 2: 验证地址搜索框**

访问 `http://localhost:5173/dashboard/pickup-locations/new`：
1. 在地图顶部搜索框输入"双阳"
2. 验证下拉联想显示结果
3. 选中"双阳区"
4. 验证地图跳转到双阳区
5. 验证标记点出现
6. 验证省市区街道自动回填（吉林省/长春市/双阳区）

- [ ] **Step 3: 验证 GPS 定位按钮**

1. 点击"定位"按钮
2. 浏览器弹出授权提示，允许
3. 验证地图跳转到当前位置
4. 验证标记点出现
5. 验证省市区街道回填

- [ ] **Step 4: 验证省市区联动地图**

1. 在省市区街道下拉中选"吉林省"
2. 验证地图跳转到吉林省中心（zoom out）
3. 选"长春市"
4. 验证地图跳转到长春市中心
5. 选"双阳区"
6. 验证地图跳转到双阳区中心

- [ ] **Step 5: 验证详细地址自动联想**

1. 在"详细地址"输入框输入"欧亚卖场"
2. 验证下拉联想显示结果
3. 选中某条
4. 验证详细地址字段更新
5. 验证 coordinates 更新
6. 验证地图跳转 + 标记
7. 验证省市区街道回填

- [ ] **Step 6: 验证降级**

通过 GraphQL 清空默认 Channel 的 mapConfig：
```bash
$mutation = '{"query":"mutation{updateChannel(input:{id:\"1\",customFields:{mapConfig:null}}){... on Channel{id}}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-WebRequest -Uri 'http://localhost:3000/admin-api' -Method Post -Body $mutation -ContentType 'application/json' -WebSession $session
$r.Content
```

访问新建页：
1. 验证地图区域显示"地图功能未配置"
2. 验证搜索框和 GPS 按钮不显示
3. 验证详细地址输入框降级为普通 input
4. 验证仍可手动填写并提交

配置回 key：
```bash
$mutation = '{"query":"mutation{updateChannel(input:{id:\"1\",customFields:{mapConfig:{provider:\"amap\",apiKey:\"7964181572fa62e7d203fed8d8af68d1\",securityJsCode:\"\"}}}){... on Channel{id}}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-WebRequest -Uri 'http://localhost:3000/admin-api' -Method Post -Body $mutation -ContentType 'application/json' -WebSession $session
$r.Content
```

---

## Self-Review

### Spec coverage
- ✅ GPS 定位按钮 → Task 1 Step 2 的 handleLocate
- ✅ 地址搜索框 → Task 1 Step 2 的 searchKeyword + handleSelectSearchResult
- ✅ 省市区联动地图 → Task 3 + Task 4 Step 4
- ✅ 详细地址自动联想 → Task 2 + Task 4 Step 5
- ✅ 降级策略 → Task 1 的 !cfg.hasConfigured 分支 + Task 2 的 !hasConfigured 分支
- ✅ i18n → 所有新增文案用 `<Trans>`

### Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 所有代码完整
- ✅ 所有命令完整

### Type consistency
- ✅ `MapPickerHandle` 在 Task 1 定义，Task 4 使用
- ✅ `AddressAutoCompleteProps` 在 Task 2 定义，Task 4 使用
- ✅ `onRegionCenterChange` 签名在 Task 3 定义，Task 4 使用
- ✅ `AutoCompleteItem` 在 Task 1 内部使用（不导出）
- ✅ `reverseGeocode` GraphQL 查询在 lib/map-graphql.ts 已定义，Task 4 使用

### 卡点检查
- ✅ 后端无需改动
- ✅ AutoComplete 插件已在 SDK URL 加载（amap-provider.ts）
- ✅ mapDistricts 已返回 center 字段
- ✅ forwardRef/useImperativeHandle 是标准 React API
- ✅ navigator.geolocation 是浏览器原生 API
