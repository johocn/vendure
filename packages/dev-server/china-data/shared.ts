import { INestApplication } from '@nestjs/common';
import {
    Channel,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
    User,
} from '@vendure/core';

export interface StageResult {
    name: string;
    ok: boolean;
    durationMs: number;
    error?: string;
}

let cachedSuperAdminUser: User | undefined;

export async function getSuperAdminUser(app: INestApplication): Promise<User> {
    if (cachedSuperAdminUser) return cachedSuperAdminUser;
    const conn = app.get(TransactionalConnection);
    const userRepo = conn.rawConnection.getRepository('User');
    const user = (await userRepo.findOne({
        where: { identifier: 'superadmin@china.test' },
        relations: ['roles', 'roles.channels'],
    })) as User | null;
    if (!user) throw new Error('superadmin user not found');
    cachedSuperAdminUser = user;
    return user;
}

export async function createAdminCtx(
    app: INestApplication,
    channelOrToken: Channel | string,
): Promise<RequestContext> {
    const ctxService = app.get(RequestContextService);
    const user = await getSuperAdminUser(app);
    return ctxService.create({ apiType: 'admin', channelOrToken, user });
}

export async function withPlainCtx(
    app: INestApplication,
    channel: Channel,
    fn: (ctx: RequestContext) => Promise<void>,
): Promise<void> {
    // 普通 ctx（无 user），仅用于 bootstrap 阶段创建 superadmin 用户本身
    const ctxService = app.get(RequestContextService);
    const ctx = await ctxService.create({ apiType: 'admin', channelOrToken: channel });
    await fn(ctx);
}

export async function withCtx(
    app: INestApplication,
    channel: Channel,
    fn: (ctx: RequestContext) => Promise<void>,
): Promise<void> {
    // 带 superadmin user 的 ctx，用于需要 admin 权限的操作
    const ctx = await createAdminCtx(app, channel);
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
