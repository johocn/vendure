import { defineDashboardExtension } from '@vendure/dashboard';

import { invoiceBlock } from './invoice-block';

defineDashboardExtension({
    pageBlocks: [invoiceBlock],
});
