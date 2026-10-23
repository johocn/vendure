import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
export declare class SlotLockService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     */
    lock(ctx: RequestContext, order: Order | null): Promise<boolean>;
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 仅由「Cancelled 状态转换」调用一次（状态机保证每单只触发一次），
     * 因此无需额外幂等标记；lockedCount 用 GREATEST 兜底防负数。
     */
    unlock(ctx: RequestContext, orderId: number): Promise<boolean>;
}
