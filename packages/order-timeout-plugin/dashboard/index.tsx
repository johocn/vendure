import { defineDashboardExtension } from '@vendure/dashboard';

import { orderTimeoutChannelDetailForms } from './channel-detail-forms';

defineDashboardExtension({
    detailForms: orderTimeoutChannelDetailForms,
});
