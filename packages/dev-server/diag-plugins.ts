/* eslint-disable no-console */
import 'dotenv/config';
import { setConfig, getConfig, runPluginConfigurations } from '@vendure/core';
import { devConfig } from './dev-config';

(async () => {
    // 模拟 preBootstrapConfig：先 setConfig(userConfig)，再 runPluginConfigurations(getConfig())
    await setConfig(devConfig as any);
    const c1 = await runPluginConfigurations(getConfig() as any);
    console.log('[after run1] Address=', (c1 as any).customFields.Address?.length);

    // 再次 setConfig + runPluginConfigurations（模拟 bootstrap 内再次调用）
    await setConfig(devConfig as any);
    const c2 = await runPluginConfigurations(getConfig() as any);
    console.log('[after run2] Address=', (c2 as any).customFields.Address?.length);

    for (const entity of ['Address', 'OrderLine', 'StockMovement']) {
        const fields = ((c2 as any).customFields?.[entity] ?? []) as Array<{ name: string }>;
        const counts: Record<string, number> = {};
        for (const f of fields) counts[f.name] = (counts[f.name] ?? 0) + 1;
        const dups = Object.entries(counts).filter(([, c]) => c > 1);
        console.log(`[${entity}] total=${fields.length} dups=${JSON.stringify(dups)}`);
    }
})().catch(e => {
    console.error('ERR', e?.message ?? e);
    process.exit(1);
});