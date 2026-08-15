import { Suspense, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { sections } from './section-registry.js';

export const Route = createFileRoute('/_authenticated/_tenant-settings/tenant-settings')({
    component: TenantSettingsPage,
});

function TenantSettingsPage() {
    const { activeChannel } = useChannel();
    const channelId = activeChannel?.id;
    const [active, setActive] = useState(sections[0].key);
    const ActiveComponent = sections.find((s) => s.key === active)!.component;

    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold">租户设置中心</h1>
            {channelId ? (
                <>
                    <div className="my-2 flex flex-wrap gap-1">
                        {sections.map((s) => (
                            <button
                                key={s.key}
                                className={s.key === active ? 'rounded bg-primary px-3 py-1 text-primary-foreground' : 'rounded px-3 py-1 hover:bg-muted'}
                                onClick={() => setActive(s.key)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <Suspense fallback={<div>加载中…</div>}>
                        <ActiveComponent channelId={channelId} />
                    </Suspense>
                </>
            ) : (
                <p className="text-muted-foreground">请先在右上角渠道切换器选择一个渠道。</p>
            )}
        </div>
    );
}