import { defineDashboardExtension } from '@vendure/dashboard';

import { flashSaleBlock } from './flash-sale-block';
import { flashSaleDetail } from './flash-sale-detail';
import { flashSaleList } from './flash-sale-list';

defineDashboardExtension({
    routes: [flashSaleList, flashSaleDetail],
    pageBlocks: [flashSaleBlock],
});
