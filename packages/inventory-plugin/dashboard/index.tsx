import { defineDashboardExtension } from '@vendure/dashboard';

import { supplierList } from './supplier-list';
import { purchaseOrderList } from './purchase-order-list';

defineDashboardExtension({
    routes: [supplierList, purchaseOrderList],
});