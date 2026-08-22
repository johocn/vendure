import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getSuppliers = graphql(`
    query GetSuppliers($options: SupplierListOptions) {
        suppliers(options: $options) {
            items {
                id
                code
                name
                taxNumber
                contactName
                contactPhone
                address
                settlementDays
                note
                createdAt
            }
            totalItems
        }
    }
`);

export const supplierList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'sales',
        id: 'inventory-suppliers',
        url: '/inventory/suppliers',
        title: '供应商',
        requiresPermission: ['ManageSupplier'],
    },
    path: '/inventory/suppliers',
    loader: () => ({ breadcrumb: '供应商' }),
    component: route => (
        <ListPage
            pageId="supplier-list"
            title={<Trans>供应商管理</Trans>}
            listQuery={getSuppliers}
            route={route}
            defaultSort={[{ id: 'createdAt', desc: true }]}
            defaultVisibility={{
                address: false,
                note: false,
            }}
            customizeColumns={{
                settlementDays: {
                    header: '账期(天)',
                    cell: ({ row }) => <span>{row.original.settlementDays}</span>,
                },
            }}
        />
    ),
};