import { ModuleRef } from '@nestjs/core';
import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusNotifyService } from './campus-notify.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
export type ExceptionAction = 'reassign' | 'refund_diff' | 'coupon' | 'refund_all';
export interface DispatchAlert {
    orderId: string;
    orderCode: string;
    type: 'stale_open' | 'sla_breach' | 'slot_full' | 'exception';
    detail: string;
    exceptionNote?: string | null;
    exceptionPhotos?: string[] | null;
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
export declare class DispatchAdminService {
    private connection;
    private grab;
    private hall;
    private capacity;
    private moduleRef;
    private notify;
    private orderSvc?;
    private couponSvc?;
    constructor(connection: TransactionalConnection, grab: HallGrabService, hall: HallService, capacity: CapacityService, moduleRef: ModuleRef, notify: CampusNotifyService);
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector();
    board(ctx: RequestContext): Promise<{
        paused: boolean;
        alerts: DispatchAlert[];
        hallOrders: Order[];
        activeOrders: Order[];
        ridersOnline: DispatchRider[];
        handledOrders: HandedException[];
    }>;
    /** 手动派单/改派：信任 admin 输入的目标骑手（MVP 不校验资质）。
     * grabByRider 返回 false 表示订单已不在大厅（已被抢/已退款）。 */
    assign(ctx: RequestContext, orderId: ID, riderCustomerId: ID): Promise<{
        assigned: boolean;
    }>;
    /** 回大厅（改派前置）：清骑手指派字段，hallStatus 复位 open */
    backToHall(ctx: RequestContext, orderId: ID): Promise<{
        backToHall: boolean;
    }>;
    /** 异常处置（plan 3.4）：仅 deliveryStatus='exception' 的订单可处置。
     * reassign：回大厅（可再抢/强派）；refund_diff：部分退款完结；coupon：发补偿券完结；
     * refund_all：全额退款+取消订单完结。完结单 hallStatus='exception_final' 退出调度墙，
     * 全部动作写 exceptionAction* 记录留痕。 */
    handleException(ctx: RequestContext, orderId: ID, action: ExceptionAction, amount?: number, couponTemplateId?: ID, note?: string): Promise<{
        ok: boolean;
        action: ExceptionAction;
    }>;
    /** 部分退款（fork 无 core RefundService，走 OrderService.refundOrder/settleRefund，与 T4 同源）。
     * refund 表 shipping/adjustment 列 NOT NULL 必须显式传 0；
     * 幂等保护：累计已退 + 本次 ≤ payment.amount，超额抛错。 */
    private refundAmount;
    /** 全额退单：退剩余未退部分 + cancelOrder（行取消+状态转换，同 T4） */
    private refundAllAndCancel;
    private getOrderService;
    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析（同 dispatch-job），
     * 未安装/未启用/解析失败返回 null。 */
    private getCouponService;
}
