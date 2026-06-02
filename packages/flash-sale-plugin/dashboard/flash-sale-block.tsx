import { LabeledData } from '@/vdb/components/labeled-data.js';
import { useLocalFormat } from '@/vdb/hooks/use-local-format.js';
import { Trans } from '@lingui/react/macro';
import { DetailPageButton, DashboardPageBlockDefinition } from '@vendure/dashboard';

export const flashSaleBlock: DashboardPageBlockDefinition = {
    id: 'flash-sale-info',
    title: <Trans>Flash Sale</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'group-buy-info', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.flashSaleActivityId;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        const { formatDate } = useLocalFormat();
        if (!cf?.flashSaleActivityId) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="Activity ID">
                    <DetailPageButton href={`/flash-sale-activities/${cf.flashSaleActivityId}`} label={String(cf.flashSaleActivityId)} />
                </LabeledData>
                {cf.flashSaleStartAt && (
                    <LabeledData label="Start At">{formatDate(cf.flashSaleStartAt)}</LabeledData>
                )}
                {cf.flashSaleEndAt && (
                    <LabeledData label="End At">{formatDate(cf.flashSaleEndAt)}</LabeledData>
                )}
            </div>
        );
    },
};
