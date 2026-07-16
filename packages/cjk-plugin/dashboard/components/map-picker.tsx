// e:\code\vendure\packages\cjk-plugin\dashboard\components\map-picker.tsx
import { useQuery } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getMapSdkConfig, reverseGeocode } from '../lib/map-graphql';
import { loadMapSdk } from './map-sdk-loader';

export interface MapPickerHandle {
    setCenter: (lng: number, lat: number, withMarker?: boolean, zoom?: number) => void;
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
        setCenter: (lng: number, lat: number, withMarker = true, zoom?: number) => {
            const AMap = (window as any).AMap;
            if (!mapRef.current) return;
            mapRef.current.setCenter([lng, lat]);
            if (zoom != null) {
                mapRef.current.setZoom(zoom);
            }
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
