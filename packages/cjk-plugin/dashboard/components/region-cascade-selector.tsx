// e:\code\vendure\packages\cjk-plugin\dashboard\components\region-cascade-selector.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    onRegionCenterChange?: (center: { lat: number; lng: number }, level: 'province' | 'city' | 'district' | 'street') => void;
}

interface DistrictNode {
    adcode: string;
    name: string;
    level: string;
    center: { lat: number; lng: number };
}

export function RegionCascadeSelector({ value, onChange, hasConfigured, onRegionCenterChange }: RegionCascadeSelectorProps) {
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

    useEffect(() => {
        if (!streetsQuery.data || !value.street) return;
        const streets = streetsQuery.data.mapDistricts as DistrictNode[];
        const matched = streets.find(s => s.name === value.street);
        if (matched && !selectedAdcodes.street) {
            setSelectedAdcodes(prev => ({ ...prev, street: matched.adcode }));
        }
    }, [streetsQuery.data, value.street]);

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
        if (node?.center) onRegionCenterChange?.(node.center, 'province');
    };

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (citiesQuery.data?.mapDistricts as DistrictNode[])?.find(c => c.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: adcode, district: undefined, street: undefined }));
        onChange({ province: value.province, city: node?.name ?? '', district: '', street: '' });
        if (node?.center) onRegionCenterChange?.(node.center, 'city');
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (districtsQuery.data?.mapDistricts as DistrictNode[])?.find(d => d.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, province: prev.province, city: prev.city, district: adcode, street: undefined }));
        onChange({ province: value.province, city: value.city, district: node?.name ?? '', street: '' });
        if (node?.center) onRegionCenterChange?.(node.center, 'district');
    };

    const handleStreetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const adcode = e.target.value;
        const node = (streetsQuery.data?.mapDistricts as DistrictNode[])?.find(s => s.adcode === adcode);
        setSelectedAdcodes(prev => ({ ...prev, street: adcode }));
        onChange({ province: value.province, city: value.city, district: value.district, street: node?.name ?? '' });
        // 街道定位不准，不触发地图跳转
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
                    <option value="">请选择</option>
                    {options?.map(o => (
                        <option key={o.adcode} value={o.adcode}>{o.name}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
