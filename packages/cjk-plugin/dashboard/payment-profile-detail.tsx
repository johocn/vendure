import { graphql } from '@vendure/dashboard';
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

const getPaymentProfileDetail = graphql(`
    query GetPaymentProfileDetail($id: ID!) {
        paymentProfile(id: $id) {
            id
            name
            code
            description
            isGlobal
            installmentOptions
            paymentMethods {
                id
                code
                name
            }
        }
    }
`);

const getPaymentMethods = graphql(`
    query GetPaymentMethods($options: ListQueryOptions) {
        paymentMethods(options: $options) {
            items {
                id
                code
                name
            }
            totalItems
        }
    }
`);

const createPaymentProfile = graphql(`
    mutation CreatePaymentProfile($input: CreatePaymentProfileInput!) {
        createPaymentProfile(input: $input) {
            id
            name
        }
    }
`);

const updatePaymentProfile = graphql(`
    mutation UpdatePaymentProfile($input: UpdatePaymentProfileInput!) {
        updatePaymentProfile(input: $input) {
            id
            name
        }
    }
`);

export const paymentProfileDetail: DashboardRouteDefinition = {
    path: '/payment-profiles/$id',
    loader: detailPageRouteLoader({
        queryDocument: getPaymentProfileDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/payment-profiles', label: '支付档案' },
            isNew ? '新建' : (entity as any)?.name ?? '详情',
        ],
    }),
    component: route => <PaymentProfileDetailPage route={route} />,
};

function PaymentProfileDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const navigate = useNavigate();

    const { form, submitHandler, entity, isPending } = useDetailPage<any, any, any>({
        queryDocument: getPaymentProfileDetail,
        createDocument: createPaymentProfile,
        updateDocument: updatePaymentProfile,
        params: { id: params.id },
        setValuesForUpdate: (p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            description: p.description,
            isGlobal: p.isGlobal,
            installmentOptions: p.installmentOptions,
            paymentMethodIds: p.paymentMethods?.map((pm: any) => pm.id) ?? [],
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

    const paymentMethodsQuery = useQuery({
        queryKey: ['paymentMethods'],
        queryFn: () => api.query(getPaymentMethods, { options: { take: 100 } }),
    });
    const allPaymentMethods = paymentMethodsQuery.data?.paymentMethods?.items ?? [];

    const selectedMethodIds = form.watch('paymentMethodIds') ?? [];

    const togglePaymentMethod = (methodId: string) => {
        const current = form.getValues('paymentMethodIds') ?? [];
        const updated = current.includes(methodId)
            ? current.filter((id: string) => id !== methodId)
            : [...current, methodId];
        form.setValue('paymentMethodIds', updated, { shouldDirty: true });
    };

    return (
        <Page pageId="payment-profile-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{entity?.name ?? <Trans>新建支付档案</Trans>}</PageTitle>
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
                            render={({ field }) => <TextInput {...field} placeholder="如：线上支付" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="code"
                            label={<Trans>编码</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="如：online-payment" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="description"
                            label={<Trans>描述</Trans>}
                            render={({ field }) => <TextInput {...field} placeholder="描述说明" />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="isGlobal"
                            label={<Trans>全局档案</Trans>}
                            render={({ field }) => <BooleanInput {...field} />}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <PageBlock column="main" blockId="payment-methods">
                    <h3 className="text-lg font-medium mb-2"><Trans>可用支付方式</Trans></h3>
                    <div className="space-y-2 border rounded-lg p-4">
                        {allPaymentMethods.length === 0 && (
                            <p className="text-gray-500 text-sm"><Trans>加载中...</Trans></p>
                        )}
                        {allPaymentMethods.map((method: any) => (
                            <label key={method.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                <input
                                    type="checkbox"
                                    checked={selectedMethodIds.includes(method.id)}
                                    onChange={() => togglePaymentMethod(method.id)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{method.name} ({method.code})</span>
                            </label>
                        ))}
                    </div>
                </PageBlock>
                <PageBlock column="main" blockId="installment-options">
                    <h3 className="text-lg font-medium mb-2"><Trans>分期选项</Trans></h3>
                    <p className="text-sm text-gray-500 mb-2"><Trans>配置分期选项（JSON 格式，如：{'{'}"alipay": {'{'}"huabei": {'{'}"periods": [3, 6, 12]{'}'}{'}'}{'}'}）</Trans></p>
                    <Controller
                        control={form.control}
                        name="installmentOptions"
                        render={({ field }) => (
                            <textarea
                                className="w-full border rounded px-3 py-2 text-sm font-mono h-24"
                                value={field.value ? JSON.stringify(field.value, null, 2) : ''}
                                onChange={(e) => {
                                    try {
                                        field.onChange(JSON.parse(e.target.value));
                                    } catch {
                                        field.onChange(e.target.value);
                                    }
                                }}
                                placeholder='{"alipay":{"huabei":{"periods":[3,6,12]}}}'
                            />
                        )}
                    />
                </PageBlock>
            </PageLayout>
        </Page>
    );
}