import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getPickupLocationDetail = graphql(`
    query GetPickupLocationDetail($id: ID!) {
        pickupLocation(id: $id) {
            id
            name
            type
            address
            phoneNumber
            businessHours
            coordinates
            partner
        }
    }
`);

const createPickupLocation = graphql(`
    mutation CreatePickupLocation($input: CreatePickupLocationInput!) {
        createPickupLocation(input: $input) {
            id
        }
    }
`);

const updatePickupLocation = graphql(`
    mutation UpdatePickupLocation($input: UpdatePickupLocationInput!) {
        updatePickupLocation(input: $input) {
            id
        }
    }
`);

export const pickupLocationDetail: DashboardRouteDefinition = {
    path: '/pickup-locations/$id',
    loader: detailPageRouteLoader({
        queryDocument: getPickupLocationDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/pickup-locations', label: 'Pickup Locations' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="pickup-location-detail"
            queryDocument={getPickupLocationDetail}
            createDocument={createPickupLocation}
            updateDocument={updatePickupLocation}
            route={route}
            title={location => location?.name ?? '新建自提点'}
            setValuesForUpdate={location => ({
                id: location.id,
                name: location.name,
                type: location.type,
                address: location.address,
                phoneNumber: location.phoneNumber,
                businessHours: location.businessHours,
                coordinates: location.coordinates,
                partner: location.partner,
            })}
        />
    ),
};
