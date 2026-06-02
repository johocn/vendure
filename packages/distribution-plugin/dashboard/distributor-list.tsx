import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getDistributors = graphql(`
    query GetDistributors($options: DistributorListOptions) {
        distributors(options: $options) {
            items {
                id
                customerId
                parentId
                level
                status
                totalEarnings
                availableBalance
                frozenBalance
                referralCode
            }
            totalItems
        }
    }
`);

export const distributorList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'distributors',
        url: '/distributors',
        title: 'Distributors',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/distributors',
    loader: () => ({
        breadcrumb: 'Distributors',
    }),
    component: route => (
        <ListPage
            pageId="distributor-list"
            title={<Trans>Distributors</Trans>}
            listQuery={getDistributors}
            route={route}
            defaultVisibility={{
                parentId: false,
                level: false,
                frozenBalance: false,
                referralCode: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                referralCode: {
                    header: 'Referral Code',
                    cell: ({ row }) => <span className="font-mono text-sm">{row.original.referralCode}</span>,
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            active: 'bg-green-100 text-green-800',
                            frozen: 'bg-blue-100 text-blue-800',
                            pending: 'bg-yellow-100 text-yellow-800',
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
