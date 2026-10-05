import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
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
export declare class DispatchAdminService {
    private connection;
    private grab;
    private hall;
    private capacity;
    constructor(connection: TransactionalConnection, grab: HallGrabService, hall: HallService, capacity: CapacityService);
    board(ctx: RequestContext): Promise<{
        paused: boolean;
        alerts: DispatchAlert[];
        hallOrders: Order[];
        activeOrders: Order[];
        ridersOnline: DispatchRider[];
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
}
