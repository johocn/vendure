import { defineDashboardExtension } from '@vendure/dashboard';

import { couponOrderBlock } from './coupon-order-block';
import { couponList } from './coupon-list';
import { couponDetail } from './coupon-detail';

defineDashboardExtension({
    routes: [couponList, couponDetail],
    pageBlocks: [couponOrderBlock],
});
