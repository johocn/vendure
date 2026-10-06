import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ID,
    Injector,
    Logger,
    Order,
    OrderService,
    Payment,
    Refund,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';

export type ExceptionAction = 'reassign' | 'refund_diff' | 'coupon' | 'refund_all';

export interface DispatchAlert {
    orderId: string;
    orderCode: string;
    type: 'stale_open' | 'sla_breach' | 'slot_full' | 'exception';
    detail: string;
    exceptionNote?: string | null; // 骑手上报说明（plan 3.4 处置卡展示）
    exceptionPhotos?: string[] | null; // 骑手存证照片
}

export interface DispatchRider {
    customerId: string;
    realName: string;
    credit: number;
}

export interface HandedException {
    orderId: string;
    orderCode: string;
    exceptionType: string | null;
    action: string;
    compensation: number | null;
    couponTemplateId: string | null;
    note: string | null;
    handledAt: string | null;
    handledBy: string;
}

/**
 * T3 调度看板 + 手动派单/改派（admin）。
 * board：按渠道拉取 hallStatus 非空订单，分类为大厅/进行中，产出四类告警
 * （stale_open / sla_breach / slot_full / exception）与在线骑手列表；
 * exception_final（已处置完结）不进墙，单独输出 handledOrders 留痕（plan 3.4）。
 * assign：手动强派（复用 grabByRider 事务+悲观锁原语，订单已不在大厅则抛错）。
 * backToHall：改派前置——先回大厅（清骑手指派字段），再由 admin 重新派单。
 * handleException（plan 3.4）：异常单三选一处置——重派回大厅 / 退差价 / 发补偿券 / 全额退单，
 * 全部动作写 exceptionAction* 记录字段留痕。
 */
@Injectable()
export class DispatchAdminService {
    private orderSvc?: OrderService;
    private couponSvc?: { grantCoupon: (ctx: RequestContext, templateId: ID, customerIds: ID[]) => Promise<string[]> } | null;

    constructor(
        private connection: TransactionalConnection,
        private grab: HallGrabService,
        private hall: HallService,
        private capacity: CapacityService,
        private moduleRef: ModuleRef,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

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
        const handled: Order[] = [];
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.hallStatus === 'exception_final') {
                // 已处置完结（plan 3.4）：不进调度墙，进留痕列表
                handled.push(o);
                continue;
            }
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
                    exceptionNote: cf.exceptionNote ?? null,
                    exceptionPhotos: cf.exceptionPhotos ?? null,
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
        const handledOrders: HandedException[] = handled
            .sort((a, b) => {
                const ta = new Date((a.customFields as any).exceptionHandledAt ?? 0).getTime();
                const tb = new Date((b.customFields as any).exceptionHandledAt ?? 0).getTime();
                return tb - ta;
            })
            .slice(0, 10)
            .map(o => {
                const cf = o.customFields as any;
                return {
                    orderId: String(o.id),
                    orderCode: o.code,
                    exceptionType: cf.exceptionType ?? null,
                    action: cf.exceptionAction ?? '',
                    compensation: cf.exceptionCompensation ?? null,
                    couponTemplateId: cf.exceptionCouponTemplateId ?? null,
                    note: cf.exceptionHandledNote ?? null,
                    handledAt: cf.exceptionHandledAt ?? null,
                    handledBy: cf.exceptionHandledBy ?? '',
                };
            });
        return { paused: cfg?.paused ?? false, alerts, hallOrders, activeOrders, ridersOnline, handledOrders };
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

    /** 异常处置（plan 3.4）：仅 deliveryStatus='exception' 的订单可处置。
     * reassign：回大厅（可再抢/强派）；refund_diff：部分退款完结；coupon：发补偿券完结；
     * refund_all：全额退款+取消订单完结。完结单 hallStatus='exception_final' 退出调度墙，
     * 全部动作写 exceptionAction* 记录留痕。 */
    async handleException(
        ctx: RequestContext,
        orderId: ID,
        action: ExceptionAction,
        amount?: number,
        couponTemplateId?: ID,
        note?: string,
    ) {
        const order = await this.connection.getRepository(ctx, Order).findOne({ where: { id: orderId as any } });
        if (!order) throw new UserInputError('订单不存在');
        if ((order.customFields as any).deliveryStatus !== 'exception') {
            throw new UserInputError('仅骑手上报异常的订单可处置');
        }
        switch (action) {
            case 'reassign':
                await this.hall.backToHall(ctx, order.id as any);
                break;
            case 'refund_diff':
                if (!amount || amount <= 0) throw new UserInputError('赔付金额必须大于 0');
                await this.refundAmount(ctx, order, amount, `exception diff refund (${order.code})`);
                break;
            case 'coupon': {
                if (!couponTemplateId) throw new UserInputError('请选择补偿券模板');
                const coupon = this.getCouponService();
                if (!coupon) throw new UserInputError('券服务不可用');
                if (!order.customerId) throw new UserInputError('订单无客户信息，无法发券');
                await coupon.grantCoupon(ctx, couponTemplateId, [order.customerId as any]);
                break;
            }
            case 'refund_all':
                await this.refundAllAndCancel(ctx, order);
                break;
            default:
                throw new UserInputError('未知处置动作');
        }
        const patch: any = {
            exceptionAction: action,
            exceptionCompensation: action === 'refund_diff' ? amount : null,
            exceptionCouponTemplateId: action === 'coupon' ? String(couponTemplateId) : null,
            exceptionHandledNote: note ?? null,
            exceptionHandledAt: new Date(),
            exceptionHandledBy: String(ctx.activeUserId ?? ''),
        };
        if (action !== 'reassign') {
            patch.hallStatus = 'exception_final';
            if (action === 'refund_all') patch.campusCause = 'exception_refund';
        }
        await this.connection.getRepository(ctx, Order).update(order.id, { customFields: patch });
        Logger.info(`Order ${order.code} exception handled: ${action}`, 'CampusDispatch');
        return { ok: true, action };
    }

    /** 部分退款（fork 无 core RefundService，走 OrderService.refundOrder/settleRefund，与 T4 同源）。
     * refund 表 shipping/adjustment 列 NOT NULL 必须显式传 0；
     * 幂等保护：累计已退 + 本次 ≤ payment.amount，超额抛错。 */
    private async refundAmount(ctx: RequestContext, order: Order, amount: number, reason: string) {
        const orderSvc = this.getOrderService();
        const payment = await this.connection.rawConnection.getRepository(Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' as any },
        });
        if (!payment) throw new UserInputError('订单无支付记录，无法退款');
        const refunded = await this.connection.rawConnection
            .getRepository(Refund)
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.total), 0)', 'sum')
            .where('r."paymentId" = :pid', { pid: payment.id })
            .getRawOne();
        if (Number(refunded?.sum ?? 0) + amount > Number(payment.amount)) {
            throw new UserInputError('退款金额超过可退余额（订单可能已全额退款）');
        }
        const created = await orderSvc.refundOrder(ctx, {
            paymentId: payment.id,
            amount,
            shipping: 0,
            adjustment: 0,
            reason,
        } as any);
        if (!created || (created as any).errorCode) {
            throw new Error(`refundOrder failed: ${(created as any)?.errorCode ?? 'no result'}`);
        }
        await orderSvc.settleRefund(ctx, { id: (created as any).id } as any);
    }

    /** 全额退单：退剩余未退部分 + cancelOrder（行取消+状态转换，同 T4） */
    private async refundAllAndCancel(ctx: RequestContext, order: Order) {
        const orderSvc = this.getOrderService();
        const payment = await this.connection.rawConnection.getRepository(Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' as any },
        });
        if (payment) {
            const refunded = await this.connection.rawConnection
                .getRepository(Refund)
                .createQueryBuilder('r')
                .select('COALESCE(SUM(r.total), 0)', 'sum')
                .where('r."paymentId" = :pid', { pid: payment.id })
                .getRawOne();
            const rest = Number(payment.amount) - Number(refunded?.sum ?? 0);
            if (rest > 0) {
                await this.refundAmount(ctx, order, rest, `exception full refund (${order.code})`);
            }
        }
        const cancelled = await orderSvc.cancelOrder(ctx, {
            orderId: order.id as any,
            reason: `exception full refund cancel (${order.code})`,
        } as any);
        if (cancelled && (cancelled as any).errorCode) {
            throw new Error(`cancelOrder failed: ${(cancelled as any).errorCode}`);
        }
    }

    private getOrderService(): OrderService {
        if (!this.orderSvc) this.orderSvc = this.injector.get(OrderService);
        return this.orderSvc;
    }

    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析（同 dispatch-job），
     * 未安装/未启用/解析失败返回 null。 */
    private getCouponService():
        | { grantCoupon: (ctx: RequestContext, templateId: ID, customerIds: ID[]) => Promise<string[]> }
        | null {
        if (this.couponSvc !== undefined) return this.couponSvc ?? null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod: any = require('@vendure/coupon-plugin');
            this.couponSvc = mod?.CouponService ? this.injector.get(mod.CouponService) : null;
        } catch {
            this.couponSvc = null;
        }
        return this.couponSvc ?? null;
    }
}
