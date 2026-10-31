import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Channel, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { withAdvisoryLock } from './advisory-lock';
import { MerchantAdminService } from './merchant-admin.service';
import { PeriodicFallback } from './periodic-fallback';

const loggerCtx = 'CampusAfterSalesAutoAssign';
/** 启动后首跑延迟：等迁移补 Channel 自定义字段与 DB 连接稳定 */
const BOOT_DELAY_MS = 120_000;
/** 扫描周期：5 分钟，新售后单尽快落到处理人名下 */
const INTERVAL_MS = 5 * 60_000;

/**
 * 售后自动分配（§96）：扫描开启自动分配的渠道，把未指派的未完结售后单
 * 派给当前未完结量最少的本店管理员（具体规则见 MerchantAdminService.afterSalesAutoAssign）。
 * - 分配给谁由服务层保证：同一单只会落一个处理人（指派表按 requestId 唯一）。
 * - 单个渠道失败只告警，不影响其他渠道。
 */
@Injectable()
export class AfterSalesAutoAssignJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;

    constructor(private connection: TransactionalConnection, private merchant: MerchantAdminService) {}

    start(): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({
            name: 'after-sales-auto-assign',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() =>
            // 多实例互斥：拿不到锁说明其他实例正在分配，本轮直接跳过（避免重复指派历史/值班预警推送）
            withAdvisoryLock(this.connection, 'campus:after-sales-auto-assign', () => this.run()),
        );
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
            channels = await this.connection.rawConnection
                .getRepository(Channel)
                .createQueryBuilder('channel')
                .where('channel.customFields.waimaiAfterSalesAutoAssignEnabled = :on', { on: true })
                .getMany();
        } catch (e: any) {
            // 列缺失（迁移未跑完）时本轮跳过
            Logger.warn(`query auto-assign channels failed: ${String(e?.message ?? e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                const ctx = new RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                const assigned = await this.merchant.afterSalesAutoAssign(ctx);
                if (assigned > 0) {
                    Logger.info(`auto-assigned ${assigned} request(s) for channel ${channel.code}`, loggerCtx);
                }
            } catch (e: any) {
                Logger.warn(`auto-assign failed for channel ${channel.code}: ${String(e?.message ?? e)}`, loggerCtx);
            }
        }
    }
}
