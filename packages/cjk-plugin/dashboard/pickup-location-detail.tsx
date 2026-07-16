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
    TextInput,
    toast,
    useDetailPage,
    api,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useRef } from 'react';
import { MapPicker, MapPickerHandle } from './components/map-picker';
import { AddressAutoComplete } from './components/address-auto-complete';
import { RegionCascadeSelector, RegionValue } from './components/region-cascade-selector';
import { getMapSdkConfig, reverseGeocode } from './lib/map-graphql';

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
    const mapPickerRef = useRef<MapPickerHandle>(null);

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
        // 街道字段不自动回填（高德 town 数据不准），留给用户手填
    };

    const handleReverseGeocodePromise = async (lat: number, lng: number) => {
        try {
            const result = await api.query(reverseGeocode, { lat, lng });
            const addr = result.reverseGeocode;
            handleReverseGeocode(addr);
        } catch (err: any) {
            toast.error('逆地理编码失败: ' + (err?.message ?? '未知错误'));
        }
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
                                <select
                                    value={field.value ?? 'store'}
                                    onChange={field.onChange}
                                    className="w-full border rounded px-2 py-1 text-sm"
                                >
                                    <option value="store">门店</option>
                                    <option value="point">驿站</option>
                                    <option value="employee">员工自提点</option>
                                </select>
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
                                    onRegionCenterChange={(center, level) => {
                                        const zoomMap = { province: 7, city: 9, district: 11, street: 13 };
                                        mapPickerRef.current?.setCenter(center.lng, center.lat, false, zoomMap[level]);
                                    }}
                                />
                            )}
                        />
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
                                    onLocationSelect={(location) => {
                                        form.setValue('coordinates', { lat: location.lat, lng: location.lng }, { shouldDirty: true });
                                        mapPickerRef.current?.setCenter(location.lng, location.lat, true);
                                        handleReverseGeocodePromise(location.lat, location.lng);
                                    }}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="street"
                            label={<Trans>街道</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="手动填写街道，如：云山街道" />}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="map-picker">
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
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
