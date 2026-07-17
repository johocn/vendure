import { LabeledData } from '@/vdb/components/labeled-data.js';
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { api, DashboardPageBlockDefinition } from '@vendure/dashboard';
import { useQuery } from '@tanstack/react-query';

const getReviewStats = graphql(`
    query GetReviewStats($productId: ID!) {
        reviewStats(productId: $productId) {
            totalCount
            goodRate
            averageRating
        }
    }
`);

export const reviewProductBlock: DashboardPageBlockDefinition = {
    id: 'review-stats',
    title: <Trans>评价统计</Trans>,
    location: {
        pageId: 'product-detail',
        column: 'side',
        position: { blockId: 'enabled-toggle', order: 'after' },
    },
    shouldRender: () => true,
    component: ({ context }) => {
        const product = context.entity as any;
        const productId = product?.id;
        const { data, isLoading } = useQuery({
            queryKey: ['reviewStats', productId],
            queryFn: () => api.query(getReviewStats, { productId: String(productId) }),
            enabled: !!productId,
        });
        const stats = data?.reviewStats;

        if (isLoading) {
            return <div className="text-sm text-muted-foreground">加载中...</div>;
        }
        if (!stats) {
            return <div className="text-sm text-muted-foreground">暂无评价数据</div>;
        }

        return (
            <div className="space-y-2">
                <LabeledData label="评价总数">{stats.totalCount}</LabeledData>
                <LabeledData label="好评率">{stats.goodRate}%</LabeledData>
                <LabeledData label="平均评分">{stats.averageRating}</LabeledData>
            </div>
        );
    },
};
