import { defineDashboardExtension } from '@vendure/dashboard';

import { cjkChannelDetailForms } from './channel-detail-forms';
import { cjkPromotionDetailForms } from './promotion-detail-forms';
import { pickupLocationDetail } from './pickup-location-detail';
import { pickupLocationList } from './pickup-location-list';

defineDashboardExtension({
    routes: [pickupLocationList, pickupLocationDetail],
    detailForms: [...cjkChannelDetailForms, ...cjkPromotionDetailForms],
});
