import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { SubscribeMessageService } from '@vendure/wechat-subscribe-message-plugin';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';

/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
@Injectable()
export class HallService {
    /** 预约单放量窗口：scheduledFor 前 30min 才进入商家确认/抢单大厅（plan 3.1） */
    static readonly SCHEDULE_RELEASE_MIN = 30;

    constructor(
        private connection: TransactionalConnection,
        private slotLock: SlotLockService,
        private moduleRef: ModuleRef,
        private capacity: CapacityService,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    async onOrderPlaced(ctx: RequestContext, order: Order) {
        const cf = order.customFields as any;
        if (cf.orderKind === 'errand' || cf.fulfillmentRoute === 'R1' || cf.fulfillmentRoute === 'R3') {
            // 时段锁位（T0 前置）：商家确认模式同样要先锁容量（用户已支付占用时段），
            // 锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
            const locked = await this.slotLock.lock(ctx, order);
            // 预约单闸门（plan 3.1）：scheduledFor 距今超 30min 时挂 'scheduled' 暂不入厅，
            // 由调度 job 到点前 30min 放量（releaseScheduled）；临近时段照旧即时流转。
            const scheduledAt = cf.scheduledFor ? new Date(cf.scheduledFor).getTime() : NaN;
            if (!Number.isNaN(scheduledAt) && scheduledAt - Date.now() > HallService.SCHEDULE_RELEASE_MIN * 60_000) {
                await this.connection.getRepository(ctx, Order).update(order.id, {
                    customFields: {
                        hallStatus: 'scheduled',
                        ...(locked ? {} : { campusCause: 'slot_full' }),
                    },
                } as any);
                Logger.info(
                    `Order ${order.code} deferred (scheduled=${cf.scheduledFor}, slotLocked=${locked})`,
                    'CampusHall',
                );
                return;
            }
            // 商家确认模式：先挂「待商家接单」，出餐完成（merchantCookingDone）才入大厅；
            // 未启用则照旧直接入厅。商家超时未处理由调度 job 自动入厅兜底。
            const cfg = await this.connection
                .getRepository(ctx, CampusFulfillmentConfig)
                .findOne({ where: { channelId: ctx.channelId as any } });
            if (cfg?.merchantConfirmEnabled) {
                await this.connection.getRepository(ctx, Order).update(order.id, {
                    customFields: {
                        hallStatus: 'pending_merchant',
                        ...(locked ? {} : { campusCause: 'slot_full' }),
                    },
                } as any);
                Logger.info(
                    `Order ${order.code} awaiting merchant confirm (${cf.fulfillmentRoute}, slot=${cf.deliverySlotText ?? 'immediate'}, slotLocked=${locked})`,
                    'CampusHall',
                );
                return;
            }
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

    /** 预约单放量（调度 job 调用，plan 3.1）：按渠道配置进入商家确认或直接入厅 */
    async releaseScheduled(ctx: RequestContext, order: Order, cfg: CampusFulfillmentConfig | null) {
        if (cfg?.merchantConfirmEnabled) {
            await this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: { hallStatus: 'pending_merchant' },
            } as any);
            Logger.info(`Order ${order.code} scheduled → pending_merchant`, 'CampusHall');
            return;
        }
        await this.connection.getRepository(ctx, Order).update(order.id, {
            customFields: { hallStatus: 'open', hallEnteredAt: new Date() },
        } as any);
        Logger.info(`Order ${order.code} scheduled → hall open`, 'CampusHall');
        this.notifyRiders(ctx, order);
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
