import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
    api,
    BooleanInput,
    Button,
    DashboardRouteDefinition,
    DateTimeInput,
    DetailFormGrid,
    detailPageRouteLoader,
    FormFieldWrapper,
    NumberInput,
    Page,
    PageActionBar,
    PageActionBarRight,
    PageBlock,
    PageLayout,
    PageTitle,
    TextareaInput,
    TextInput,
    toast,
    useDetailPage,
    usePermissions,
} from '@vendure/dashboard';

const getCouponDetail = graphql(`
    query GetCouponDetail($id: ID!) {
        coupon(id: $id) {
            id
            name
            description
            couponType
            discountValue
            minSpend
            maxDiscount
            startAt
            endAt
            totalQuantity
            claimedCount
            limitPerUser
            isActive
            applicableProductIds
            applicableCategoryIds
            isNewUserOnly
            isGlobal
            ownerChannelId
            enabledInCurrentChannel
            createdAt
            updatedAt
        }
    }
`);

const createCoupon = graphql(`
    mutation CreateCoupon($input: CreateCouponInput!) {
        createCoupon(input: $input) {
            id
            name
        }
    }
`);

const updateCoupon = graphql(`
    mutation UpdateCoupon($id: ID!, $input: UpdateCouponInput!) {
        updateCoupon(id: $id, input: $input) {
            id
            name
        }
    }
`);

export const couponDetail: DashboardRouteDefinition = {
    path: '/coupons/$id',
    loader: detailPageRouteLoader({
        queryDocument: getCouponDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/coupons', label: '优惠券' },
            isNew ? '新建优惠券' : (entity as any)?.name ?? '优惠券详情',
        ],
    }),
    component: route => <CouponDetailPage route={route} />,
};

function CouponDetailPage({ route }: { route: any }) {
    const params = route.useParams();
    const navigate = useNavigate();
    const creatingNewEntity = params.id === 'new';
    const { hasPermissions } = usePermissions();
    const isSuperAdmin = hasPermissions(['SuperAdmin']);
    const [submitting, setSubmitting] = useState(false);

    const { form, entity, isPending, resetForm } = useDetailPage<any, any, any>({
        queryDocument: getCouponDetail,
        createDocument: createCoupon,
        updateDocument: updateCoupon,
        setValuesForUpdate: (coupon: any) => ({
            name: coupon.name,
            description: coupon.description,
            startAt: coupon.startAt,
            endAt: coupon.endAt,
            totalQuantity: coupon.totalQuantity,
            limitPerUser: coupon.limitPerUser,
            isActive: coupon.isActive,
            minSpend: coupon.minSpend,
            maxDiscount: coupon.maxDiscount,
            isNewUserOnly: coupon.isNewUserOnly,
        }),
        params: { id: params.id },
        onSuccess: async (data: any) => {
            if (creatingNewEntity && data?.id) {
                toast.success('优惠券创建成功');
                await navigate({ to: `/coupons/${data.id}` });
            }
        },
        onError: (err: any) => {
            toast.error('保存失败: ' + (err?.message ?? '未知错误'));
        },
    });

    const customSubmitHandler = form.handleSubmit(async (values: any) => {
        setSubmitting(true);
        try {
            if (creatingNewEntity) {
                const input = Object.fromEntries(
                    Object.entries(values).filter(([, v]) => v != null && v !== ''),
                );
                const result = await api.mutate(createCoupon, { input });
                toast.success('优惠券创建成功');
                await navigate({ to: `/coupons/${result.createCoupon.id}` });
            } else {
                await api.mutate(updateCoupon, { id: params.id, input: values });
                toast.success('优惠券更新成功');
                resetForm();
            }
        } catch (err: any) {
            toast.error('保存失败: ' + (err?.message ?? '未知错误'));
        } finally {
            setSubmitting(false);
        }
    });

    const coupon = entity as any;

    return (
        <Page
            pageId="coupon-detail"
            form={form}
            submitHandler={customSubmitHandler}
            entity={entity}
        >
            <PageTitle>
                {creatingNewEntity ? '新建优惠券' : (coupon?.name ?? '优惠券详情')}
            </PageTitle>
            <PageActionBar>
                <PageActionBarRight>
                    <Button
                        type="submit"
                        disabled={!form.formState.isDirty || isPending || submitting}
                    >
                        {creatingNewEntity ? '创建' : '保存'}
                    </Button>
                </PageActionBarRight>
            </PageActionBar>
            <PageLayout>
                {/* 侧栏：状态开关 */}
                <PageBlock column="side" blockId="status">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="isActive"
                            label={<Trans>启用状态</Trans>}
                            description={<Trans>启用后优惠券可在店铺中使用</Trans>}
                            render={({ field }) => (
                                <BooleanInput value={field.value} onChange={field.onChange} />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="isNewUserOnly"
                            label={<Trans>仅限新用户</Trans>}
                            render={({ field }) => (
                                <BooleanInput value={field.value} onChange={field.onChange} />
                            )}
                        />
                        {creatingNewEntity && isSuperAdmin && (
                            <FormFieldWrapper
                                control={form.control}
                                name="isGlobal"
                                label={<Trans>全局优惠券</Trans>}
                                description={<Trans>全局券由超管创建，所有渠道可见并可启用</Trans>}
                                render={({ field }) => (
                                    <BooleanInput value={field.value} onChange={field.onChange} />
                                )}
                            />
                        )}
                        {!creatingNewEntity && coupon?.isGlobal && (
                            <div className="space-y-1">
                                <span className="font-medium text-muted-foreground text-xs">
                                    全局优惠券
                                </span>
                                <div className="text-sm">
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                        是
                                    </span>
                                </div>
                            </div>
                        )}
                    </DetailFormGrid>
                </PageBlock>

                {/* 主区域：基本信息 */}
                <PageBlock column="main" blockId="basic-info" title="基本信息">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="name"
                            label={<Trans>优惠券名称</Trans>}
                            render={({ field }) => (
                                <TextInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder="如：满100减20"
                                />
                            )}
                        />
                        <div></div>
                    </DetailFormGrid>
                    <div className="mb-4 mt-4">
                        <FormFieldWrapper
                            control={form.control}
                            name="description"
                            label={<Trans>描述</Trans>}
                            render={({ field }) => (
                                <TextareaInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                </PageBlock>

                {/* 主区域：优惠规则 */}
                <PageBlock column="main" blockId="discount-rules" title="优惠规则">
                    <DetailFormGrid>
                        {creatingNewEntity ? (
                            <>
                                <FormFieldWrapper
                                    control={form.control}
                                    name="couponType"
                                    label={<Trans>优惠类型</Trans>}
                                    render={({ field }) => (
                                        <select
                                            value={field.value ?? 'fixed'}
                                            onChange={field.onChange}
                                            className="w-full rounded border px-2 py-1 text-sm"
                                        >
                                            <option value="fixed">固定金额（元）</option>
                                            <option value="percentage">百分比（%）</option>
                                        </select>
                                    )}
                                />
                                <FormFieldWrapper
                                    control={form.control}
                                    name="discountValue"
                                    label={<Trans>优惠值</Trans>}
                                    render={({ field }) => (
                                        <NumberInput
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            min={0}
                                        />
                                    )}
                                />
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <span className="font-medium text-muted-foreground text-xs">
                                        优惠类型
                                    </span>
                                    <div className="text-sm">
                                        {coupon?.couponType === 'fixed'
                                            ? '固定金额'
                                            : coupon?.couponType === 'percentage'
                                              ? '百分比'
                                              : coupon?.couponType}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="font-medium text-muted-foreground text-xs">
                                        优惠值
                                    </span>
                                    <div className="text-sm">
                                        {coupon?.couponType === 'percentage'
                                            ? `${coupon?.discountValue}%`
                                            : `¥${coupon?.discountValue}`}
                                    </div>
                                </div>
                            </>
                        )}
                        <FormFieldWrapper
                            control={form.control}
                            name="minSpend"
                            label={<Trans>最低消费（元）</Trans>}
                            render={({ field }) => (
                                <NumberInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    min={0}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="maxDiscount"
                            label={<Trans>最大优惠（元）</Trans>}
                            description={<Trans>百分比折扣时的封顶金额，0表示不封顶</Trans>}
                            render={({ field }) => (
                                <NumberInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    min={0}
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>

                {/* 主区域：有效期与数量 */}
                <PageBlock column="main" blockId="validity" title="有效期与数量">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="startAt"
                            label={<Trans>开始时间</Trans>}
                            render={({ field }) => (
                                <DateTimeInput
                                    value={field.value}
                                    onChange={(value: any) => field.onChange(value)}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="endAt"
                            label={<Trans>结束时间</Trans>}
                            render={({ field }) => (
                                <DateTimeInput
                                    value={field.value}
                                    onChange={(value: any) => field.onChange(value)}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="totalQuantity"
                            label={<Trans>发放总量</Trans>}
                            render={({ field }) => (
                                <NumberInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    min={1}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="limitPerUser"
                            label={<Trans>每人限领</Trans>}
                            render={({ field }) => (
                                <NumberInput
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    min={1}
                                />
                            )}
                        />
                    </DetailFormGrid>
                    {!creatingNewEntity && coupon?.claimedCount != null && (
                        <div className="mt-4 text-sm text-muted-foreground">
                            已领取数量：{coupon.claimedCount} / {coupon.totalQuantity}
                        </div>
                    )}
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
