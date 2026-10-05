import { Injectable } from '@nestjs/common';
import { Injector, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { SubscribeMessageService } from '@vendure/wechat-subscribe-message-plugin';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';

/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
@Injectable()
export class HallService {
    constructor(
        private connection: TransactionalConnection,
        private slotLock: SlotLockService,
        private injector: Injector,
        private capacity: CapacityService,
    ) {}

    async onOrderPlaced(ctx: RequestContext, order: Order) {
        const cf = order.customFields as any;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            const locked = await this.slotLock.lock(ctx, order);
            await this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: {
                    hallStatus: 'open',
                    hallEnteredAt: new Date(),
                    ...(locked ? {} : { campusCause: 'slot_full' }),
                },
            } as any);
            Logger.info(
                `Order ${order.code} entered hall (${cf.fulfillmentRoute}, slot=${cf.deliverySlotText ?? 'immediate'}, slotLocked=${locked})`,
                'CampusHall',
            );
            this.notifyRiders(ctx, order);
        }
    }

    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用） */
    async backToHall(ctx: RequestContext, orderId: number) {
        await this.connection.getRepository(ctx, Order).update(orderId, {
            customFields: { hallStatus: 'open', deliveryStaffId: null, deliveryStatus: null, assignedAt: null },
        } as any);
    }

    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx: RequestContext, orderId: number, patch: any) {
        return this.connection.getRepository(ctx, Order).update(orderId, patch as any);
    }

    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    private notifyRiders(ctx: RequestContext, order: Order) {
        void (async () => {
            try {
                const templateId = ((ctx.channel as any)?.customFields ?? {}).orderShippedTemplateId as
                    | string
                    | undefined;
                if (!templateId) {
                    Logger.debug(
                        `Channel ${ctx.channelId} has no orderShippedTemplateId, skip rider notify`,
                        'CampusHall',
                    );
                    return;
                }
                const msg = this.injector.get(SubscribeMessageService);
                const riders = await this.capacity.listOnlineRiders(ctx);
                for (const r of riders) {
                    try {
                        await msg.sendCustomMessage(ctx, r.id as any, templateId, {
                            orderCode: { value: order.code },
                            zone: { value: (order.customFields as any).campusZone ?? '' },
                        });
                    } catch (e: any) {
                        Logger.warn(`rider notify failed (customer ${r.id}): ${e?.message}`, 'CampusHall');
                    }
                }
            } catch (e: any) {
                Logger.warn(`rider notify failed: ${e?.message}`, 'CampusHall');
            }
        })();
    }
}
