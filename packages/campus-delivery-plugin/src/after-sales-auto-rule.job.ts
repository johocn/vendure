import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Channel, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { MerchantAdminService } from './merchant-admin.service';
import { PeriodicFallback } from './periodic-fallback';

const loggerCtx = 'CampusAfterSalesAutoRule';
/** 启动后首跑延迟：等迁移补分流规则表与订单数据稳定 */
const BOOT_DELAY_MS = 90_000;
/** 扫描周期：2 分钟，新售后单尽快按规则分流 */
const INTERVAL_MS = 2 * 60_000;

/**
 * 售后自动分流（§98）：按渠道执行 campus_after_sales_auto_rule，
 * 命中规则的待处理售后单自动同意 / 驳回 / 转平台仲裁。
 * - 只处理近 7 日未分流过的 Pending 单（服务层写 autoRuleAppliedAt 防重复）。
 * - 渠道级咨询锁：多实例部署同一渠道只有一个进程执行，避免重复退款。
 */
@Injectable()
export class AfterSalesAutoRuleJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;

    constructor(private connection: TransactionalConnection, private merchant: MerchantAdminService) {}

    start(): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({
            name: 'after-sales-auto-rule',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => this.run());
    }

    stop(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    onApplicationShutdown(): void {
        this.stop();
    }

    async run(): Promise<void> {
        let channels: Channel[];
        try {
            channels = await this.connection.rawConnection.getRepository(Channel).find();
        } catch (e: any) {
            Logger.warn(`query channels failed: ${String(e?.message ?? e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                await this.runChannelWithLock(channel);
            } catch (e: any) {
                Logger.warn(`auto rule failed for channel ${channel.code}: ${String(e?.message ?? e)}`, loggerCtx);
            }
        }
    }

    private async runChannelWithLock(channel: Channel): Promise<void> {
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:asrule:${channel.id}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return;
            try {
                const ctx = new RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                const applied = await this.merchant.applyAfterSalesAutoRules(ctx);
                if (applied > 0) {
                    Logger.info(`auto-ruled ${applied} request(s) for channel ${channel.code}`, loggerCtx);
                }
            } finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        } finally {
            await runner.release();
        }
    }
}
