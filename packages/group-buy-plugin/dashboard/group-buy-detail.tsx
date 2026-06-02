import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getGroupBuyDetail = graphql(`
    query GetGroupBuyDetail($id: ID!) {
        groupBuyActivity(id: $id) {
            id
            name
            description
            targetCount
            currentCount
            maxCount
            status
            startAt
            endAt
            groupPrice
            leaderDiscount
            leaderRewardType
            autoConfirm
            allowJoinAfterComplete
            createdAt
            updatedAt
        }
    }
`);

const createGroupBuyActivity = graphql(`
    mutation CreateGroupBuyActivity($input: CreateGroupBuyActivityInput!) {
        createGroupBuyActivity(input: $input) {
            id
        }
    }
`);

const updateGroupBuyActivity = graphql(`
    mutation UpdateGroupBuyActivity($input: UpdateGroupBuyActivityInput!) {
        updateGroupBuyActivity(input: $input) {
            id
        }
    }
`);

export const groupBuyDetail: DashboardRouteDefinition = {
    path: '/group-buy-activities/$id',
    loader: detailPageRouteLoader({
        queryDocument: getGroupBuyDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/group-buy-activities', label: 'Group Buy' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="group-buy-detail"
            queryDocument={getGroupBuyDetail}
            createDocument={createGroupBuyActivity}
            updateDocument={updateGroupBuyActivity}
            route={route}
            title={activity => activity.name}
            setValuesForUpdate={activity => ({
                id: activity.id,
                name: activity.name,
                description: activity.description,
                targetCount: activity.targetCount,
                maxCount: activity.maxCount,
                startAt: activity.startAt,
                endAt: activity.endAt,
                groupPrice: activity.groupPrice,
                leaderDiscount: activity.leaderDiscount,
                status: activity.status,
            })}
        />
    ),
};
