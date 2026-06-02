import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getGroupBuyActivities = graphql(`
    query GetGroupBuyActivities($options: Json) {
        groupBuyActivities(options: $options) {
            items {
                id
                name
                status
                targetCount
                currentCount
                maxCount
                groupPrice
                startAt
                endAt
            }
            totalItems
        }
    }
`);

export const groupBuyList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'group-buy-activities',
        url: '/group-buy-activities',
        title: 'Group Buy',
        requiresPermission: ['ReadPromotion'],
    },
    path: '/group-buy-activities',
    loader: () => ({
        breadcrumb: 'Group Buy',
    }),
    component: route => (
        <ListPage
            pageId="group-buy-list"
            title={<Trans>Group Buy Activities</Trans>}
            listQuery={getGroupBuyActivities}
            route={route}
            defaultVisibility={{
                maxCount: false,
                groupPrice: false,
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
                            active: 'bg-green-100 text-green-800',
                            completed: 'bg-blue-100 text-blue-800',
                            expired: 'bg-gray-100 text-gray-800',
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
