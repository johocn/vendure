import { Injectable } from '@nestjs/common';
import { ID, Order, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';

export interface DispatchAlert {
    orderId: string;
    orderCode: string;
    type: 'stale_open' | 'sla_breach' | 'slot_full' | 'exception';
    detail: string;
}

export interface DispatchRider {
    customerId: string;
    realName: string;
    credit: number;
}

/**
 * T3 调度看板 + 手动派单/改派（admin）。
 * board：按渠道拉取 hallStatus 非空订单，分类为大厅/进行中，产出四类告警
 * （stale_open / sla_breach / slot_full / exception）与在线骑手列表。
 * assign：手动强派（复用 grabByRider 事务+悲观锁原语，订单已不在大厅则抛错）。
 * backToHall：改派前置——先回大厅（清骑手指派字段），再由 admin 重新派单。
 */
@Injectable()
export class DispatchAdminService {
    constructor(
        private connection: TransactionalConnection,
        private grab: HallGrabService,
        private hall: HallService,
        private capacity: CapacityService,
    ) {}

    async board(ctx: RequestContext) {
        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        // 渠道过滤：Order 无标量 channelId，join order.channels（同 core findOneInChannel 模式）。
        // customFields 为嵌入式物理列，QueryBuilder 必须用 embedded 路径 order.customFields.hallStatus。
        const orders = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            .getMany();
        const now = Date.now();
        const alerts: DispatchAlert[] = [];
        const hallOrders: Order[] = [];
        const activeOrders: Order[] = [];
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.hallStatus === 'scheduled') continue; // 预约单未放量，不进调度墙（商家工作台可见，plan 3.1）
            if (cf.hallStatus === 'open') {
                hallOrders.push(o);
                if (cf.campusCause === 'slot_full') {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'slot_full',
                        detail: '预约时段锁位失败（运力满），需人工跟进',
                    });
                }
                const enteredAt = cf.hallEnteredAt;
                if (enteredAt && now - new Date(enteredAt).getTime() > (cfg?.autoAssignMinutes ?? 10) * 60_000) {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'stale_open',
                        detail: `大厅滞留超 ${cfg?.autoAssignMinutes ?? 10} 分钟，自动派单未完成`,
                    });
                }
            } else if (cf.deliveryStatus === 'in_progress') {
                activeOrders.push(o);
                const at = cf.assignedAt ?? cf.hallEnteredAt;
                if (at && now - new Date(at).getTime() > (cfg?.inProgressSlaMinutes ?? 45) * 60_000) {
                    alerts.push({
                        orderId: String(o.id),
                        orderCode: o.code,
                        type: 'sla_breach',
                        detail: `配送超 SLA（>${cfg?.inProgressSlaMinutes ?? 45} 分钟）`,
                    });
                }
            } else if (cf.deliveryStatus === 'exception') {
                alerts.push({
                    orderId: String(o.id),
                    orderCode: o.code,
                    type: 'exception',
                    detail: cf.exceptionType ?? '骑手上报异常',
                });
            } else {
                activeOrders.push(o);
            }
        }
        const riders = await this.capacity.listOnlineRiders(ctx);
        const ridersOnline: DispatchRider[] = riders.map(r => ({
            customerId: String(r.id),
            realName: (r.customFields as any).riderRealName ?? '',
            credit: (r.customFields as any).riderCredit ?? 100,
        }));
        return { paused: cfg?.paused ?? false, alerts, hallOrders, activeOrders, ridersOnline };
    }

    /** 手动派单/改派：信任 admin 输入的目标骑手（MVP 不校验资质）。
     * grabByRider 返回 false 表示订单已不在大厅（已被抢/已退款）。 */
    async assign(ctx: RequestContext, orderId: ID, riderCustomerId: ID) {
        const ok = await this.grab.grabByRider(ctx, orderId, { id: riderCustomerId });
        if (!ok) throw new UserInputError('派单失败：订单已不在大厅（已被抢/已退款）');
        return { assigned: true };
    }

    /** 回大厅（改派前置）：清骑手指派字段，hallStatus 复位 open */
    async backToHall(ctx: RequestContext, orderId: ID) {
        const order = await this.connection
            .getRepository(ctx, Order)
            .findOne({ where: { id: orderId as any } });
        if (!order) throw new UserInputError('订单不存在');
        await this.hall.backToHall(ctx, orderId as any);
        return { backToHall: true };
    }
}
