import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getPurchaseOrders = graphql(`
    query GetPurchaseOrders($options: PurchaseOrderListOptions, $state: String) {
        purchaseOrders(options: $options, state: $state) {
            items {
                id
                code
                state
                supplierId
                supplier {
                    id
                    name
                }
                targetLocationId
                targetLocation {
                    id
                    name
                }
                totalAmount
                orderDate
                expectedArrivalDate
                completedAt
                cancelledAt
                createdAt
            }
            totalItems
        }
    }
`);

const stateLabelMap: Record<string, string> = {
    Draft: '草稿',
    Ordered: '已下单',
    PartiallyReceived: '部分收货',
    Received: '已收货',
    Completed: '已完成',
    Cancelled: '已取消',
};

const stateColorMap: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700',
    Ordered: 'bg-blue-100 text-blue-700',
    PartiallyReceived: 'bg-yellow-100 text-yellow-800',
    Received: 'bg-green-100 text-green-800',
    Completed: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-700',
};

export const purchaseOrderList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'sales',
        id: 'inventory-purchase-orders',
        url: '/inventory/purchase-orders',
        title: '采购单',
        requiresPermission: ['ManagePurchase'],
    },
    path: '/inventory/purchase-orders',
    loader: () => ({ breadcrumb: '采购单' }),
    component: route => (
        <ListPage
            pageId="purchase-order-list"
            title={<Trans>采购补货单</Trans>}
            listQuery={getPurchaseOrders}
            route={route}
            defaultSort={[{ id: 'createdAt', desc: true }]}
            facetedFilters={{
                state: {
                    title: '状态',
                    options: [
                        { label: '草稿', value: 'Draft' },
                        { label: '已下单', value: 'Ordered' },
                        { label: '部分收货', value: 'PartiallyReceived' },
                        { label: '已收货', value: 'Received' },
                        { label: '已完成', value: 'Completed' },
                        { label: '已取消', value: 'Cancelled' },
                    ],
                },
            }}
            customizeColumns={{
                state: {
                    header: '状态',
                    cell: ({ row }) => {
                        const state = row.original.state;
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    stateColorMap[state] || ''
                                }`}
                            >
                                {stateLabelMap[state] || state}
                            </span>
                        );
                    },
                },
                totalAmount: {
                    header: '总金额(元)',
                    cell: ({ row }) => <span>¥{(row.original.totalAmount / 100).toFixed(2)}</span>,
                },
            }}
        />
    ),
};