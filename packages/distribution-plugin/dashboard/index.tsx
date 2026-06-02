import { defineDashboardExtension } from '@vendure/dashboard';
import { UserCheckIcon } from 'lucide-react';

import { commissionRecordList } from './commission-record-list';
import { distributionChannelDetailForms } from './channel-detail-forms';
import { distributionCustomerDetailForms } from './customer-detail-forms';
import { distributorDetail } from './distributor-detail';
import { distributorList } from './distributor-list';
import { withdrawalRequestList } from './withdrawal-request-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'distribution',
            title: 'Distribution',
            icon: UserCheckIcon,
            order: 700,
        },
    ],
    routes: [distributorList, distributorDetail, commissionRecordList, withdrawalRequestList],
    detailForms: [...distributionChannelDetailForms, ...distributionCustomerDetailForms],
});
