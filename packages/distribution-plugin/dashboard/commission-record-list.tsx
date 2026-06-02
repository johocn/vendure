import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getCommissionRecords = graphql(`
    query GetCommissionRecords($options: CommissionRecordListOptions) {
        commissionRecords(options: $options) {
            items {
                id
                distributorId
                orderId
                commissionType
                commissionRate
                orderAmount
                commissionAmount
                status
                settledAt
                createdAt
            }
            totalItems
        }
    }
`);

export const commissionRecordList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'commission-records',
        url: '/commission-records',
        title: 'Commissions',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/commission-records',
    loader: () => ({
        breadcrumb: 'Commission Records',
    }),
    component: route => (
        <ListPage
            pageId="commission-record-list"
            title={<Trans>Commission Records</Trans>}
            listQuery={getCommissionRecords}
            route={route}
            defaultVisibility={{
                commissionRate: false,
                settledAt: false,
            }}
            customizeColumns={{
                commissionType: {
                    header: 'Type',
                    cell: ({ row }) => {
                        const type = row.original.commissionType;
                        return type === 'direct' ? 'Direct' : 'Indirect';
                    },
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            pending: 'bg-yellow-100 text-yellow-800',
                            confirmed: 'bg-green-100 text-green-800',
                            paid: 'bg-blue-100 text-blue-800',
                            cancelled: 'bg-gray-100 text-gray-800',
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
