import { defineDashboardExtension } from '@vendure/dashboard';

import { invoicePdfBlock } from './invoice-block-enhanced';

defineDashboardExtension({
    pageBlocks: [invoicePdfBlock],
});
