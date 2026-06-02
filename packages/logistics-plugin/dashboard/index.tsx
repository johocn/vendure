import { defineDashboardExtension } from '@vendure/dashboard';

import { logisticsChannelDetailForms } from './channel-detail-forms';
import { logisticsBlock } from './logistics-block';

defineDashboardExtension({
    pageBlocks: [logisticsBlock],
    detailForms: logisticsChannelDetailForms,
});
