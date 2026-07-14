import { INestApplication } from '@nestjs/common';
import { Channel, RequestContext, RequestContextService } from '@vendure/core';

export interface StageResult {
    name: string;
    ok: boolean;
    durationMs: number;
    error?: string;
}

export async function withCtx(
    app: INestApplication,
    channel: Channel,
    fn: (ctx: RequestContext) => Promise<void>,
): Promise<void> {
    const ctxService = app.get(RequestContextService);
    const ctx = await ctxService.create({ apiType: 'admin', channelOrToken: channel });
    await fn(ctx);
}

export async function runStage(
    name: string,
    fn: () => Promise<void>,
): Promise<StageResult> {
    const start = Date.now();
    try {
        await fn();
        return { name, ok: true, durationMs: Date.now() - start };
    } catch (e: any) {
        return { name, ok: false, durationMs: Date.now() - start, error: e.message };
    }
}

export function logStage(stageIndex: number, total: number, result: StageResult): void {
    const status = result.ok ? 'OK' : 'FAIL';
    const duration = (result.durationMs / 1000).toFixed(1);
    const prefix = `[${stageIndex}/${total}] ${result.name} ... ${status} (${duration}s)`;
    console.log(result.ok ? prefix : `${prefix}\n  ERROR: ${result.error}`);
}

export function yuanToCents(yuan: number): number {
    return Math.round(yuan * 100);
}
