import { defineDashboardExtension } from '@vendure/dashboard';

import { reviewList } from './review-list';
import { reviewProductBlock } from './review-product-block';

defineDashboardExtension({
    routes: [reviewList],
    pageBlocks: [reviewProductBlock],
});
