import { graphql } from '@vendure/dashboard';
import {
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
    NumberInput,
    toast,
    useDetailPage,
    api,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';

const getShippingProfileDetail = graphql(`
    query GetShippingProfileDetail($id: ID!) {
        shippingProfile(id: $id) {
            id
            name
            code
            description
            freeShippingThreshold
            isGlobal
            shippingMethods {
                id
                code
                name
            }
        }
    }
`);

const getShippingMethods = graphql(`
    query GetShippingMethods($options: ListQueryOptions) {
        shippingMethods(options: $options) {
            items {
                id
                code
                name
            }
            totalItems
        }
    }
`);

const createShippingProfile = graphql(`
    mutation CreateShippingProfile($input: CreateShippingProfileInput!) {
        createShippingProfile(input: $input) {
            id
            name
        }
    }
`);

const updateShippingProfile = graphql(`
    mutation UpdateShippingProfile($input: UpdateShippingProfileInput!) {
        updateShippingProfile(input: $input) {
            id
            name
        }
    }
`);

export const shippingProfileDetail: DashboardRouteDefinition = {
    path: '/shipping-profiles/$id',
    loader: detailPageRouteLoader({
        queryDocument: getShippingProfileDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/shipping-profiles', label: '配送档案' },
            isNew ? '新建' : (entity as any)?.name ?? '详情',
        ],
    }),
    component: route => <ShippingProfileDetailPage route={route} />,
};

function ShippingProfileDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const navigate = useNavigate();

    const { form, submitHandler, entity, isPending } = useDetailPage<any, any, any>({
        queryDocument: getShippingProfileDetail,
        createDocument: createShippingProfile,
        updateDocument: updateShippingProfile,
        params: { id: params.id },
        setValuesForUpdate: (p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            description: p.description,
            freeShippingThreshold: p.freeShippingThreshold,
            isGlobal: p.isGlobal,
            shippingMethodIds: p.shippingMethods?.map((sm: any) => sm.id) ?? [],
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

    const shippingMethodsQuery = useQuery({
        queryKey: ['shippingMethods'],
        queryFn: () => api.query(getShippingMethods, { options: { take: 100 } }),
    });
    const allShippingMethods = shippingMethodsQuery.data?.shippingMethods?.items ?? [];

    const selectedMethodIds = form.watch('shippingMethodIds') ?? [];

    const toggleShippingMethod = (methodId: string) => {
        const current = form.getValues('shippingMethodIds') ?? [];
        const updated = current.includes(methodId)
            ? current.filter((id: string) => id !== methodId)
            : [...current, methodId];
        form.setValue('shippingMethodIds', updated, { shouldDirty: true });
    };

    return (
        <Page pageId="shipping-profile-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{entity?.name ?? <Trans>新建配送档案</Trans>}</PageTitle>
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
                            render={({ field }) => <TextInput {...field} placeholder="如：冷链配送" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="code"
                            label={<Trans>编码</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="如：cold-chain" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="description"
                            label={<Trans>描述</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="描述说明" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="freeShippingThreshold"
                            label={<Trans>免邮门槛（元）</Trans>}
                            render={({ field }) => (
                                <NumberInput
                                    {...field}
                                    value={field.value ?? ''}
                                    placeholder="留空则使用各配送方式自身规则"
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="shipping-methods">
                    <h3 className="text-lg font-medium mb-2"><Trans>可用配送方式</Trans></h3>
                    <div className="space-y-2 border rounded-lg p-4">
                        {allShippingMethods.length === 0 && (
                            <p className="text-gray-500 text-sm"><Trans>加载中...</Trans></p>
                        )}
                        {allShippingMethods.map((method: any) => (
                            <label key={method.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                <input
                                    type="checkbox"
                                    checked={selectedMethodIds.includes(method.id)}
                                    onChange={() => toggleShippingMethod(method.id)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{method.name} ({method.code})</span>
                            </label>
                        ))}
                    </div>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}