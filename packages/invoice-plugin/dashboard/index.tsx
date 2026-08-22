import { defineDashboardExtension } from '@vendure/dashboard';

import { invoiceBlock } from './invoice-block';
import { invoiceList } from './invoice-list';

defineDashboardExtension({
    routes: [invoiceList],
    pageBlocks: [invoiceBlock],
});
