import { defineDashboardExtension } from '@vendure/dashboard';

import { cjkChannelDetailForms } from './channel-detail-forms';
import { cjkPromotionDetailForms } from './promotion-detail-forms';
import { pickupLocationDetail } from './pickup-location-detail';
import { pickupLocationList } from './pickup-location-list';
import { shippingProfileDetail } from './shipping-profile-detail';
import { shippingProfileList } from './shipping-profile-list';
import { paymentProfileDetail } from './payment-profile-detail';
import { paymentProfileList } from './payment-profile-list';
import { TenantConfigCenter } from './tenant-config-center';

defineDashboardExtension({
    routes: [
        pickupLocationList,
        pickupLocationDetail,
        shippingProfileList,
        shippingProfileDetail,
        paymentProfileList,
        paymentProfileDetail,
    ],
    detailForms: [...cjkChannelDetailForms, ...cjkPromotionDetailForms],
    pageBlocks: [
        {
            id: 'tenant-config-center',
            title: '租户配置中心',
            location: {
                pageId: 'channel-detail',
                column: 'main',
                position: { blockId: 'custom-fields', order: 'after' },
            },
            component: TenantConfigCenter,
        },
    ],
});
