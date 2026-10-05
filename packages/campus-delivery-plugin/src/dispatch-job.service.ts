import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Channel, ID, Order } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { CREDIT_LIMIT, CREDIT_TIMEOUT, RiderCreditService } from './rider-credit.service';

const NOT_PICKED_TIMEOUT_MIN = 15;

@Injectable()
export class DispatchJobService implements OnApplicationShutdown {
    private timer: ReturnType<typeof setInterval> | null = null;
    private running = false;

    constructor(
        private connection: TransactionalConnection,
        private grab: HallGrabService,
        private hall: HallService,
        private capacity: CapacityService,
        private credit: RiderCreditService,
    ) {}

    start(intervalMs = 60_000) {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this.tick().catch(e => Logger.error(`dispatch tick: ${e?.message}`, 'CampusDispatch'));
        }, intervalMs);
    }

    onApplicationShutdown() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private async tick() {
        if (this.running) return; // 上一轮未结束跳过
        this.running = true;
        try {
            // 扫描跨渠道：逐渠道配置构造真实 RequestContext（getRepository 仅接受 RequestContext 实例）
            const cfgs = await this.connection.rawConnection
                .getRepository(CampusFulfillmentConfig)
                .find();
            for (const cfg of cfgs) {
                await this.scan(this.ctxForChannel(cfg.channelId));
            }
        } finally {
            this.running = false;
        }
    }

    private ctxForChannel(channelId: ID): RequestContext {
        return new RequestContext({
            apiType: 'admin',
            channel: new Channel({ id: channelId }),
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    async scan(ctx: RequestContext) {
        const repo = this.connection.getRepository(ctx, Order);
        const orders = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.hallStatus IN ('open', 'grabbed')")
            .getMany();
        const now = Date.now();

        // 1) assigned 超 15min 未取货 → 回大厅 + 扣分
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.hallStatus === 'grabbed' && cf.deliveryStatus === 'assigned' && cf.assignedAt) {
                if (now - new Date(cf.assignedAt).getTime() > NOT_PICKED_TIMEOUT_MIN * 60_000) {
                    await this.hall.backToHall(ctx, o.id as any);
                    await this.credit.adjust(ctx, Number(cf.deliveryStaffId), CREDIT_TIMEOUT, 'timeout_not_picked', o.id as any);
                    Logger.warn(`Order ${o.code} reassigned (rider ${cf.deliveryStaffId} not picked in ${NOT_PICKED_TIMEOUT_MIN}min)`, 'CampusDispatch');
                }
            }
        }

        // 2) T2 强派
        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        if (!cfg) return;
        const riders = await this.capacity.listOnlineRiders(ctx);
        const eligible = riders
            .filter(r => ((r.customFields as any).riderCredit ?? 100) >= CREDIT_LIMIT)
            .sort((a, b) => {
                const ca = (a.customFields as any).riderCredit ?? 100;
                const cb = (b.customFields as any).riderCredit ?? 100;
                if (cb !== ca) return cb - ca; // 信用分高者优先
                const ta = new Date((a.customFields as any).riderOnlineAt).getTime();
                const tb = new Date((b.customFields as any).riderOnlineAt).getTime();
                return tb - ta; // 最近活跃优先
            });
        if (!eligible.length) return;
        const stale = orders.filter(o => {
            const cf = o.customFields as any;
            return cf.hallStatus === 'open' && this.orderInChannel(o, cfg) && cf.hallEnteredAt
                && now - new Date(cf.hallEnteredAt).getTime() > (cfg.autoAssignMinutes ?? 10) * 60_000;
        }).sort((a, b) => new Date((a.customFields as any).hallEnteredAt).getTime()
                 - new Date((b.customFields as any).hallEnteredAt).getTime());
        for (const o of stale) {
            const ok = await this.grab.grabByRider(ctx, o.id as any, eligible[0]);
            if (ok) Logger.warn(`Order ${o.code} auto-assigned to rider ${eligible[0].id} (T2)`, 'CampusDispatch');
            // grabByRider 内部乐观锁失败（已被抢/已退款）返回 false，跳过即可
        }
    }

    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    private orderInChannel(o: Order, cfg: CampusFulfillmentConfig): boolean {
        const channels = (o as any).channels as Array<{ id: ID }> | undefined;
        return !channels?.length || channels.some(c => c.id != null && String(c.id) === String(cfg.channelId));
    }
}
