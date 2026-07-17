import { PageContextValue } from '@vendure/dashboard';

import { TenantConfigTabs } from './tenant-config-tabs';

export function TenantConfigCenter({ context }: { context: PageContextValue }) {
    const channelId = context.entity?.id;
    if (!channelId) return null;
    return <TenantConfigTabs channelId={String(channelId)} />;
}
