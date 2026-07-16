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
