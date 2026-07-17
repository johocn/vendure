import { LabeledData } from '@/vdb/components/labeled-data.js';
import { useQuery } from '@/vdb/lib/query.js';
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { api, DashboardPageBlockDefinition } from '@vendure/dashboard';

const getMemberInfo = graphql(`
    query GetMemberInfo($customerId: ID!) {
        memberInfo(customerId: $customerId) {
            level
            levelName
            growthValue
            points
            nextLevelThreshold
            nextLevelName
        }
    }
`);

export const memberInfoBlock: DashboardPageBlockDefinition = {
    id: 'member-info',
    title: <Trans>会员信息</Trans>,
    location: {
        pageId: 'customer-detail',
        column: 'side',
        position: { blockId: 'customer-stats', order: 'after' },
    },
    shouldRender: context => {
        const customer = context.entity as any;
        return !!customer?.customFields?.memberLevel;
    },
    component: ({ context }) => {
        const customer = context.entity as any;
        const customerId = customer?.id;
        const { data, isLoading } = useQuery({
            queryKey: ['memberInfo', customerId],
            queryFn: () => api.query(getMemberInfo, { customerId }),
            enabled: !!customerId,
        });

        if (isLoading) {
            return <div className="text-sm text-gray-500">加载中...</div>;
        }

        const memberInfo = data?.memberInfo;
        if (!memberInfo) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="等级">{memberInfo.level}</LabeledData>
                <LabeledData label="等级名称">{memberInfo.levelName}</LabeledData>
                <LabeledData label="成长值">{memberInfo.growthValue}</LabeledData>
                <LabeledData label="积分">{memberInfo.points}</LabeledData>
                {memberInfo.nextLevelThreshold != null && (
                    <LabeledData label="下一等级门槛">{memberInfo.nextLevelThreshold}</LabeledData>
                )}
                {memberInfo.nextLevelName && (
                    <LabeledData label="下一等级名称">{memberInfo.nextLevelName}</LabeledData>
                )}
            </div>
        );
    },
};
