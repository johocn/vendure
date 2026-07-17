import { defineDashboardExtension } from '@vendure/dashboard';

import { memberInfoBlock } from './member-info-block';

defineDashboardExtension({
    pageBlocks: [memberInfoBlock],
});
