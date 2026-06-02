import { defineDashboardExtension } from '@vendure/dashboard';
import { UsersIcon } from 'lucide-react';

import { groupBuyBlock } from './group-buy-block';
import { groupBuyDetail } from './group-buy-detail';
import { groupBuyList } from './group-buy-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'marketing',
            title: 'Marketing',
            icon: UsersIcon,
            order: 600,
        },
    ],
    routes: [groupBuyList, groupBuyDetail],
    pageBlocks: [groupBuyBlock],
});
