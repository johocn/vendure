import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getPickupLocations = graphql(`
    query GetPickupLocations($options: ListQueryOptions) {
        pickupLocations(options: $options) {
            items {
                id
                name
                type
                address
                phoneNumber
                businessHours
                partner
            }
            totalItems
        }
    }
`);

export const pickupLocationList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'settings',
        id: 'pickup-locations',
        url: '/pickup-locations',
        title: 'Pickup Locations',
        requiresPermission: ['ReadSettings'],
    },
    path: '/pickup-locations',
    loader: () => ({
        breadcrumb: 'Pickup Locations',
    }),
    component: route => (
        <ListPage
            pageId="pickup-location-list"
            title={<Trans>Pickup Locations</Trans>}
            listQuery={getPickupLocations}
            route={route}
            defaultVisibility={{
                phoneNumber: false,
                businessHours: false,
                partner: false,
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
            }}
        />
    ),
};
