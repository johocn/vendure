import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getCoupons = graphql(`
    query GetCoupons {
        coupons {
            items {
                id
                name
                couponType
                discountValue
                minSpend
                startAt
                endAt
                totalQuantity
                claimedCount
                isActive
            }
            totalItems
        }
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
    component: route => (
        <ListPage
            pageId="coupon-list"
            title={<Trans>优惠券</Trans>}
            listQuery={getCoupons}
            route={route}
            customizeColumns={{
                isActive: {
                    header: '状态',
                    cell: ({ row }) => {
                        const isActive = row.original.isActive;
                        const colorClass = isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800';
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                                {isActive ? '启用' : '停用'}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
