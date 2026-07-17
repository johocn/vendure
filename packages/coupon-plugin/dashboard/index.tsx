import { defineDashboardExtension } from '@vendure/dashboard';

import { couponOrderBlock } from './coupon-order-block';
import { couponList } from './coupon-list';

defineDashboardExtension({
    routes: [couponList],
    pageBlocks: [couponOrderBlock],
});
