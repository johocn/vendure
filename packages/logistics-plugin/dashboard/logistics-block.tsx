import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DashboardPageBlockDefinition } from '@vendure/dashboard';

export const logisticsBlock: DashboardPageBlockDefinition = {
    id: 'logistics-tracking',
    title: <Trans>Logistics Tracking</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'invoice-info', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        const fulfillments = order?.fulfillments;
        if (!fulfillments || !fulfillments.length) return false;
        return fulfillments.some((f: any) => f.customFields?.trackingNumber);
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const fulfillments = order?.fulfillments ?? [];

        return (
            <div className="space-y-3">
                {fulfillments.map((fulfillment: any) => {
                    const cf = fulfillment.customFields;
                    if (!cf?.trackingNumber) return null;
                    return (
                        <div key={fulfillment.id} className="space-y-2">
                            <LabeledData label="Tracking Number">{cf.trackingNumber}</LabeledData>
                            <LabeledData label="Carrier">{cf.carrier || '-'}</LabeledData>
                            <LabeledData label="Carrier Code">{cf.carrierCode || '-'}</LabeledData>
                            <LabeledData label="Shipping Note">{cf.shippingNote || '-'}</LabeledData>
                        </div>
                    );
                })}
            </div>
        );
    },
};
