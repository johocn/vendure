import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DetailPageButton, DashboardPageBlockDefinition } from '@vendure/dashboard';

export const groupBuyBlock: DashboardPageBlockDefinition = {
    id: 'group-buy-info',
    title: <Trans>Group Buy</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'logistics-tracking', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.groupBuyActivityId;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        if (!cf?.groupBuyActivityId) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="Activity ID">
                    <DetailPageButton href={`/group-buy-activities/${cf.groupBuyActivityId}`} label={String(cf.groupBuyActivityId)} />
                </LabeledData>
                <LabeledData label="Is Leader">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cf.groupBuyIsLeader ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                        {cf.groupBuyIsLeader ? 'Leader' : 'Member'}
                    </span>
                </LabeledData>
            </div>
        );
    },
};
