import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getFlashSaleDetail = graphql(`
    query GetFlashSaleDetail($id: ID!) {
        flashSaleActivity(id: $id) {
            id
            name
            startAt
            endAt
            flashPrice
            totalStock
            soldCount
            limitPerUser
            status
            createdAt
            updatedAt
        }
    }
`);

const createFlashSaleActivity = graphql(`
    mutation CreateFlashSaleActivity($input: CreateFlashSaleActivityInput!) {
        createFlashSaleActivity(input: $input) {
            id
        }
    }
`);

const updateFlashSaleActivity = graphql(`
    mutation UpdateFlashSaleActivity($input: UpdateFlashSaleActivityInput!) {
        updateFlashSaleActivity(input: $input) {
            id
        }
    }
`);

export const flashSaleDetail: DashboardRouteDefinition = {
    path: '/flash-sale-activities/$id',
    loader: detailPageRouteLoader({
        queryDocument: getFlashSaleDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/flash-sale-activities', label: 'Flash Sale' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="flash-sale-detail"
            queryDocument={getFlashSaleDetail}
            createDocument={createFlashSaleActivity}
            updateDocument={updateFlashSaleActivity}
            route={route}
            title={activity => activity.name}
            setValuesForUpdate={activity => ({
                id: activity.id,
                name: activity.name,
                startAt: activity.startAt,
                endAt: activity.endAt,
                flashPrice: activity.flashPrice,
                totalStock: activity.totalStock,
                limitPerUser: activity.limitPerUser,
                status: activity.status,
            })}
        />
    ),
};
