import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getReviews = graphql(`
    query GetReviews {
        reviews {
            items {
                id
                customerId
                productId
                rating
                content
                status
                createdAt
            }
            totalItems
        }
    }
`);

export const reviewList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'catalog',
        id: 'reviews',
        url: '/reviews',
        title: '评价管理',
        requiresPermission: ['ReadCatalog'],
    },
    path: '/reviews',
    loader: () => ({
        breadcrumb: '评价管理',
    }),
    component: route => (
        <ListPage
            pageId="review-list"
            title={<Trans>评价管理</Trans>}
            listQuery={getReviews}
            route={route}
            customizeColumns={{
                rating: {
                    header: '评分',
                    cell: ({ row }) => {
                        const rating = Number(row.original.rating) || 0;
                        return (
                            <span className="text-sm" aria-label={`${rating}/5`}>
                                <span className="text-yellow-500">{'★'.repeat(rating)}</span>
                                <span className="text-muted-foreground">{'☆'.repeat(5 - rating)}</span>
                            </span>
                        );
                    },
                },
                status: {
                    header: '状态',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            pending: 'bg-yellow-100 text-yellow-800',
                            approved: 'bg-green-100 text-green-800',
                            rejected: 'bg-red-100 text-red-800',
                        };
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}
                            >
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
