import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    Injector,
    isGraphQlErrorResult,
    Logger,
    Order,
    OrderService,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';

/**
 * 自动交易完成：扫描 state='Delivered' 且 fulfillmentDeliveredAt <= now - completeDays 的订单
 * 推进到 Completed。手动（runAutoCompleteScan mutation）/定时（order-complete-auto ScheduledTask）共用。
 * 完成天数：Channel.orderCompleteDays 覆盖 > 插件 defaultCompleteDays > 默认 3 天。
 */
@Injectable()
export class OrderCompleteAutoService {
    private injector: Injector | null = null;
    private orderService: OrderService | null = null;
    private channelService: ChannelService | null = null;
    private requestContextService: RequestContextService | null = null;

    init(injector: Injector): void {
        this.injector = injector;
        try {
            this.orderService = injector.get(OrderService);
        } catch (e) {
            Logger.warn('OrderCompleteAutoService 无法获取 OrderService', loggerCtx);
            this.orderService = null;
        }
        try {
            this.channelService = injector.get(ChannelService);
        } catch (e) {
            this.channelService = null;
        }
        try {
            this.requestContextService = injector.get(RequestContextService);
        } catch (e) {
            this.requestContextService = null;
        }
    }

    /** 定时任务入口：构造默认渠道 ctx 后扫描（内部任务，无用户上下文） */
    async runAutoCompleteJob(): Promise<number> {
        if (!this.injector) return 0;
        try {
            const ctx = this.requestContextService
                ? await this.requestContextService.create({
                      apiType: 'admin',
                      channelOrToken: await this.channelService!.getDefaultChannel(),
                  })
                : new RequestContext({
                      apiType: 'admin',
                      channel: await this.channelService!.getDefaultChannel(),
                      isAuthorized: true,
                      authorizedAsOwnerOnly: false,
                  });
            return await this.runAutoCompleteScan(ctx);
        } catch (e: any) {
            Logger.warn(`自动交易完成扫描异常: ${e?.message ?? e}`, loggerCtx);
            return 0;
        }
    }

    /** 扫描并自动完成；返回本次完成订单数 */
    async runAutoCompleteScan(ctx: RequestContext, now = new Date()): Promise<number> {
        if (!this.orderService || !this.injector) return 0;
        const connection = this.injector.get(TransactionalConnection);
        const options = this.injector.get(LOGISTICS_PLUGIN_OPTIONS) as { defaultCompleteDays?: number };
        const completeDays = (ctx.channel as any)?.customFields?.orderCompleteDays ?? options?.defaultCompleteDays ?? 3;
        const deadline = new Date(now.getTime() - completeDays * 24 * 60 * 60 * 1000);

        const repo = connection.getRepository(ctx, Order);
        const candidates = await repo
            .createQueryBuilder('order')
            .where('order.state = :state', { state: 'Delivered' })
            // 注意：不能用 active=true 过滤——core 的 OrderPlacedStrategy 在支付完成时即把
            // order.active 置为 false（下单后订单不再"活跃"），Delivered 都是非 active 订单，
            // 误加 active 过滤会导致所有已完成送达的订单永远扫不到（t8 count 恒为 0）。
            .getMany();

        let done = 0;
        for (const order of candidates) {
            const deliveredAt = (order.customFields as any)?.fulfillmentDeliveredAt;
            if (!deliveredAt) continue;
            if (new Date(deliveredAt).getTime() > deadline.getTime()) continue;
            const result = await this.orderService.transitionToState(ctx, order.id, 'Completed' as any);
            if (!isGraphQlErrorResult(result)) {
                // 落交易完成时间（售后期计时起点；已写过则跳过）
                if (!(order.customFields as any)?.fulfillmentCompletedAt) {
                    await this.orderService.updateCustomFields(ctx, order.id, { fulfillmentCompletedAt: new Date() });
                }
                done++;
                Logger.info(`自动交易完成 order#${order.code ?? order.id}`, loggerCtx);
            }
        }
        if (done > 0) {
            Logger.info(`自动交易完成扫描: 完成 ${done} 单`, loggerCtx);
        }
        return done;
    }
}
