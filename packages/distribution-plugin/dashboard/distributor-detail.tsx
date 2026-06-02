import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getDistributorDetail = graphql(`
    query GetDistributorDetail($id: ID!) {
        distributors(options: { filter: { id: { eq: $id } } }) {
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
                createdAt
                updatedAt
            }
            totalItems
        }
    }
`);

export const distributorDetail: DashboardRouteDefinition = {
    path: '/distributors/$id',
    loader: detailPageRouteLoader({
        queryDocument: getDistributorDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/distributors', label: 'Distributors' },
            isNew ? 'New' : entity?.referralCode,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="distributor-detail"
            queryDocument={getDistributorDetail}
            route={route}
            title={distributor => distributor.referralCode || distributor.id}
        />
    ),
};
