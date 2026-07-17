import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getSubscribeMessageLogs = graphql(`
    query GetSubscribeMessageLogs {
        subscribeMessageLogs {
            items {
                id
                customerId
                openid
                templateId
                status
                errorMsg
                sentAt
                createdAt
            }
            totalItems
        }
    }
`);

export const subscribeMessageLogList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'subscribe-message-logs',
        url: '/subscribe-message-logs',
        title: '订阅消息日志',
        requiresPermission: ['ReadSettings'],
    },
    path: '/subscribe-message-logs',
    loader: () => ({
        breadcrumb: '订阅消息日志',
    }),
    component: route => (
        <ListPage
            pageId="subscribe-message-log-list"
            title={<Trans>订阅消息日志</Trans>}
            listQuery={getSubscribeMessageLogs}
            route={route}
            customizeColumns={{
                status: {
                    header: '状态',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            success: 'bg-green-100 text-green-800',
                            failed: 'bg-red-100 text-red-800',
                            pending: 'bg-yellow-100 text-yellow-800',
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
