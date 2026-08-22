import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage, PageActionBarRight } from '@vendure/dashboard';

import { BulkIssueInvoicesAction } from './invoice-bulk-issue';
import { InvoiceExportButton } from './invoice-export';

const getInvoices = graphql(`
    query GetInvoices($options: InvoiceListOptions) {
        invoices(options: $options) {
            items {
                id
                invoiceNo
                title
                taxNumber
                status
                invoiceType
                amount
                customerId
                orderIds
                createdAt
                issuedAt
                reversedAt
            }
            totalItems
        }
    }
`);

const statusColorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    issued: 'bg-green-100 text-green-800',
    reversed: 'bg-gray-100 text-gray-700',
    partially_reversed: 'bg-blue-100 text-blue-700',
    voided: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700',
};

const statusLabelMap: Record<string, string> = {
    pending: '待开票',
    issued: '已开具',
    reversed: '已红冲',
    partially_reversed: '部分红冲',
    voided: '已作废',
    failed: '开票失败',
};

function invoiceTypeLabel(type: string): string {
    switch (type) {
        case 'special':
            return '专用发票';
        case 'electronic':
            return '电子发票';
        default:
            return '普通发票';
    }
}

export const invoiceList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'sales',
        id: 'invoices',
        url: '/invoices',
        title: '发票中心',
        requiresPermission: ['ReadOrder'],
    },
    path: '/invoices',
    loader: () => ({
        breadcrumb: '发票中心',
    }),
    component: route => (
        <ListPage
            pageId="invoice-list"
            title={<Trans>发票中心</Trans>}
            listQuery={getInvoices}
            route={route}
            defaultSort={[{ id: 'createdAt', desc: true }]}
            defaultVisibility={{
                taxNumber: false,
                customerId: false,
                orderIds: false,
            }}
            facetedFilters={{
                status: {
                    title: '状态',
                    options: [
                        { label: '待开票', value: 'pending' },
                        { label: '已开具', value: 'issued' },
                        { label: '已红冲', value: 'reversed' },
                        { label: '部分红冲', value: 'partially_reversed' },
                        { label: '已作废', value: 'voided' },
                        { label: '开票失败', value: 'failed' },
                    ],
                },
                invoiceType: {
                    title: '发票类型',
                    options: [
                        { label: '普通发票', value: 'ordinary' },
                        { label: '专用发票', value: 'special' },
                        { label: '电子发票', value: 'electronic' },
                    ],
                },
            }}
            bulkActions={[{ component: BulkIssueInvoicesAction }]}
            customizeColumns={{
                status: {
                    header: '状态',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    statusColorMap[status] || ''
                                }`}
                            >
                                {statusLabelMap[status] || status}
                            </span>
                        );
                    },
                },
                invoiceType: {
                    header: '类型',
                    cell: ({ row }) => <span>{invoiceTypeLabel(row.original.invoiceType)}</span>,
                },
                amount: {
                    header: '金额(元)',
                    cell: ({ row }) => <span>¥{(row.original.amount / 100).toFixed(2)}</span>,
                },
                customerId: {
                    header: '客户ID',
                    cell: ({ row }) => <span>{row.original.customerId}</span>,
                },
                orderIds: {
                    header: '关联订单',
                    cell: ({ row }) => <span>{row.original.orderIds.join(', ')}</span>,
                },
            }}
        >
            <PageActionBarRight>
                <InvoiceExportButton />
            </PageActionBarRight>
        </ListPage>
    ),
};