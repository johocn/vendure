import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getWithdrawalRequests = graphql(`
    query GetWithdrawalRequests($options: WithdrawalRequestListOptions) {
        withdrawalRequests(options: $options) {
            items {
                id
                distributorId
                amount
                method
                accountInfo
                status
                reviewedAt
                paidAt
                createdAt
            }
            totalItems
        }
    }
`);

export const withdrawalRequestList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'withdrawal-requests',
        url: '/withdrawal-requests',
        title: 'Withdrawals',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/withdrawal-requests',
    loader: () => ({
        breadcrumb: 'Withdrawal Requests',
    }),
    component: route => (
        <ListPage
            pageId="withdrawal-request-list"
            title={<Trans>Withdrawal Requests</Trans>}
            listQuery={getWithdrawalRequests}
            route={route}
            defaultVisibility={{
                reviewedAt: false,
                paidAt: false,
            }}
            customizeColumns={{
                method: {
                    header: 'Method',
                    cell: ({ row }) => {
                        const method = row.original.method;
                        const labels: Record<string, string> = { bank: 'Bank', alipay: 'Alipay', wechat: 'WeChat' };
                        return labels[method] || method;
                    },
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            pending: 'bg-yellow-100 text-yellow-800',
                            approved: 'bg-green-100 text-green-800',
                            rejected: 'bg-red-100 text-red-800',
                            paid: 'bg-blue-100 text-blue-800',
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
