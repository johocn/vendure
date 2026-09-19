import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    EventBus,
    ID,
    Logger,
    OrderPlacedEvent,
    OrderService,
    RequestContext,
} from '@vendure/core';
import { CommissionRecordCreatedEvent } from '@vendure/distribution-plugin';

import { loggerCtx } from './constants';
import { EcoReporter } from './eco-reporter.service';
import { extractSsoId } from './sso-id';

/**
 * 生态行为监听器：
 * - purchase：订单支付成功后（OrderPlacedEvent，每单恰好一次）上报下单用户
 * - distribute：分销直接佣金落库后（distribution-plugin 发布的 CommissionRecordCreatedEvent）上报 inviter
 * 所有处理均 try/catch 兜底 + fire-and-forget，失败绝不影响订单/佣金主流程。
 */
@Injectable()
export class EcoEventsListener {
    constructor(
        private eventBus: EventBus,
        private orderService: OrderService,
        private customerService: CustomerService,
        private reporter: EcoReporter,
    ) {}

    /** 由 EcoPlugin.onApplicationBootstrap 调用，避免 Nest 生命周期重复触发 */
    init(): void {
        this.eventBus.ofType(OrderPlacedEvent).subscribe(event => {
            void this.reportPurchase(event.ctx, event.order.id).catch(() => undefined);
        });

        this.eventBus.ofType(CommissionRecordCreatedEvent).subscribe(event => {
            void this.reportDistribute(event).catch(() => undefined);
        });
    }

    private async reportPurchase(ctx: RequestContext, orderId: ID): Promise<void> {
        try {
            const order = await this.orderService.findOne(ctx, orderId, ['customer']);
            const ssoId = extractSsoId(order?.customer);
            if (!ssoId || !order) {
                Logger.info(`purchase 上报跳过：订单 ${orderId} 无 SSO 身份`, loggerCtx);
                return;
            }
            this.reporter.report(ssoId, 'purchase', order.code);
        } catch (e: any) {
            Logger.warn(`purchase 上报处理失败 order=${orderId}: ${(e as Error).message}`, loggerCtx);
        }
    }

    private async reportDistribute(event: CommissionRecordCreatedEvent): Promise<void> {
        try {
            const customer = await this.customerService.findOne(event.ctx, event.distributorCustomerId);
            const ssoId = extractSsoId(customer);
            if (!ssoId) {
                Logger.info(
                    `distribute 上报跳过：inviter customer ${event.distributorCustomerId} 无 SSO 身份`,
                    loggerCtx,
                );
                return;
            }
            this.reporter.report(ssoId, 'distribute', event.orderCode);
        } catch (e: any) {
            Logger.warn(`distribute 上报处理失败 order=${event.orderId}: ${(e as Error).message}`, loggerCtx);
        }
    }
}
