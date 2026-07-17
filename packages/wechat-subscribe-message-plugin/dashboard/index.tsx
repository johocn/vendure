import { defineDashboardExtension } from '@vendure/dashboard';

import { subscribeMessageLogList } from './subscribe-message-log-list';

defineDashboardExtension({
    routes: [subscribeMessageLogList],
});
