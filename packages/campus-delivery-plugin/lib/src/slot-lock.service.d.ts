import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
export declare class SlotLockService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     * 锁位成功写 slotLocked=true，取消时只有带此标记的单才归还容量（否则未支付/锁位失败单
     * 取消会把已满时段「放空」，造成容量虚增与超卖）。
     */
    lock(ctx: RequestContext, order: Order | null): Promise<boolean>;
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 原子认领 slotLocked=true → false，保证「同一单只释放一次」，且未锁位/锁位失败的单一律不释放。
     * 返回 true 表示本次确实归还了一个名额。
     */
    unlock(ctx: RequestContext, orderId: number): Promise<boolean>;
}
