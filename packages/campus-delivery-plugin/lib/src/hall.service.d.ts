import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { SlotLockService } from './slot-lock.service';
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
export declare class HallService {
    private connection;
    private slotLock;
    constructor(connection: TransactionalConnection, slotLock: SlotLockService);
    onOrderPlaced(ctx: RequestContext, order: Order): Promise<void>;
}
