import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getFlashSaleActivities = graphql(`
    query GetFlashSaleActivities($options: Json) {
        flashSaleActivities(options: $options) {
            items {
                id
                name
                status
                flashPrice
                totalStock
                soldCount
                limitPerUser
                startAt
                endAt
            }
            totalItems
        }
    }
`);

export const flashSaleList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'flash-sale-activities',
        url: '/flash-sale-activities',
        title: 'Flash Sale',
        requiresPermission: ['ReadPromotion'],
    },
    path: '/flash-sale-activities',
    loader: () => ({
        breadcrumb: 'Flash Sale',
    }),
    component: route => (
        <ListPage
            pageId="flash-sale-list"
            title={<Trans>Flash Sale Activities</Trans>}
            listQuery={getFlashSaleActivities}
            route={route}
            defaultVisibility={{
                limitPerUser: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            upcoming: 'bg-yellow-100 text-yellow-800',
                            active: 'bg-green-100 text-green-800',
                            ended: 'bg-gray-100 text-gray-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
