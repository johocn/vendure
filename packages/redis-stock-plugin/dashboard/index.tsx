import { defineDashboardExtension } from '@vendure/dashboard';

import { redisStockChannelDetailForms } from './channel-detail-forms';

defineDashboardExtension({
    detailForms: redisStockChannelDetailForms,
});
