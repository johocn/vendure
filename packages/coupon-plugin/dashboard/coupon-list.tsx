import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import {
    api,
    Button,
    DashboardRouteDefinition,
    ListPage,
    PageActionBarRight,
    toast,
} from '@vendure/dashboard';

const getCoupons = graphql(`
    query GetCoupons {
        coupons {
            items {
                id
                name
                couponType
                discountValue
                minSpend
                maxDiscount
                startAt
                endAt
                totalQuantity
                claimedCount
                isActive
                isGlobal
                ownerChannelId
                enabledInCurrentChannel
            }
            totalItems
        }
    }
`);

const enableCouponForChannel = graphql(`
    mutation EnableCouponForChannel($id: ID!) {
        enableCouponForChannel(id: $id) {
            id
        }
    }
`);

const disableCouponForChannel = graphql(`
    mutation DisableCouponForChannel($id: ID!) {
        disableCouponForChannel(id: $id) {
            id
        }
    }
`);

const deleteCoupon = graphql(`
    mutation DeleteCoupon($id: ID!) {
        deleteCoupon(id: $id)
    }
`);

export const couponList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'coupons',
        url: '/coupons',
        title: '优惠券',
        requiresPermission: ['ReadPromotion'],
    },
    path: '/coupons',
    loader: () => ({
        breadcrumb: '优惠券',
    }),
    component: route => <CouponListPage route={route} />,
};

function CouponListPage({ route }: { route: any }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const refreshList = () => {
        void queryClient.invalidateQueries({ queryKey: ['ListPage'] });
    };

    const handleToggleEnable = async (id: string, currentlyEnabled: boolean) => {
        setActionLoadingId(id);
        try {
            if (currentlyEnabled) {
                await api.mutate(disableCouponForChannel, { id });
                toast.success('已禁用该全局优惠券');
            } else {
                await api.mutate(enableCouponForChannel, { id });
                toast.success('已启用该全局优惠券');
            }
            refreshList();
        } catch (err: any) {
            toast.error('操作失败: ' + (err?.message ?? '未知错误'));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这张优惠券吗？此操作不可撤销。')) return;
        setActionLoadingId(id);
        try {
            await api.mutate(deleteCoupon, { id });
            toast.success('删除成功');
            refreshList();
        } catch (err: any) {
            toast.error('删除失败: ' + (err?.message ?? '未知错误'));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleEdit = (id: string) => {
        void navigate({ to: `/coupons/${id}` });
    };

    return (
        <ListPage
            pageId="coupon-list"
            title={<Trans>优惠券</Trans>}
            listQuery={getCoupons}
            route={route}
            defaultVisibility={{
                name: true,
                couponType: true,
                discountValue: true,
                minSpend: true,
                startAt: true,
                endAt: true,
                totalQuantity: true,
                claimedCount: true,
                isActive: true,
                isGlobal: true,
                enabledInCurrentChannel: true,
            }}
            customizeColumns={{
                name: {
                    header: '优惠券名称',
                    cell: ({ row }) => {
                        const coupon = row.original;
                        if (coupon.isGlobal) {
                            return <span className="font-medium">{coupon.name}</span>;
                        }
                        return (
                            <Button
                                variant="ghost"
                                className="h-auto p-0 font-medium"
                                onClick={() => handleEdit(coupon.id)}
                            >
                                {coupon.name}
                            </Button>
                        );
                    },
                },
                couponType: {
                    header: '类型',
                    cell: ({ row }) => {
                        const type = row.original.couponType;
                        return (
                            <span className="text-sm">
                                {type === 'fixed' ? '固定金额' : type === 'percentage' ? '百分比' : type}
                            </span>
                        );
                    },
                },
                discountValue: {
                    header: '优惠值',
                    cell: ({ row }) => {
                        const { couponType, discountValue } = row.original;
                        return (
                            <span className="text-sm">
                                {couponType === 'percentage'
                                    ? `${discountValue}%`
                                    : `¥${discountValue}`}
                            </span>
                        );
                    },
                },
                isActive: {
                    header: '状态',
                    cell: ({ row }) => {
                        const isActive = row.original.isActive;
                        const colorClass = isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800';
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                            >
                                {isActive ? '启用' : '停用'}
                            </span>
                        );
                    },
                },
                isGlobal: {
                    header: '范围',
                    cell: ({ row }) => {
                        const isGlobal = row.original.isGlobal;
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isGlobal
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-purple-100 text-purple-800'
                                }`}
                            >
                                {isGlobal ? '全局' : '租户'}
                            </span>
                        );
                    },
                },
                enabledInCurrentChannel: {
                    header: '渠道启用',
                    cell: ({ row }) => {
                        const coupon = row.original;
                        if (!coupon.isGlobal) {
                            return <span className="text-xs text-muted-foreground">—</span>;
                        }
                        const enabled = coupon.enabledInCurrentChannel;
                        const colorClass = enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800';
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                            >
                                {enabled ? '已启用' : '未启用'}
                            </span>
                        );
                    },
                },
            }}
            additionalColumns={{
                actions: {
                    header: '操作',
                    cell: ({ row }) => {
                        const coupon = row.original;
                        const isLoading = actionLoadingId === coupon.id;

                        if (coupon.isGlobal) {
                            return (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() =>
                                        handleToggleEnable(coupon.id, coupon.enabledInCurrentChannel)
                                    }
                                >
                                    {isLoading
                                        ? '处理中...'
                                        : coupon.enabledInCurrentChannel
                                          ? '禁用'
                                          : '启用'}
                                </Button>
                            );
                        }

                        return (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => handleEdit(coupon.id)}
                                >
                                    编辑
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => handleDelete(coupon.id)}
                                >
                                    删除
                                </Button>
                            </div>
                        );
                    },
                },
            }}
        >
            <PageActionBarRight>
                <Button render={<Link to="/coupons/new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <Trans>新建优惠券</Trans>
                </Button>
            </PageActionBarRight>
        </ListPage>
    );
}
