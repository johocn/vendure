import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DashboardPageBlockDefinition } from '@vendure/dashboard';

export const couponOrderBlock: DashboardPageBlockDefinition = {
    id: 'coupon-info',
    title: <Trans>优惠券</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'flash-sale-info', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.appliedCouponCode;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        if (!cf?.appliedCouponCode) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="优惠券码">{cf.appliedCouponCode}</LabeledData>
            </div>
        );
    },
};
