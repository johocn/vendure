import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
export declare class SlotLockService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     * 幂等：先原子认领订单 slotLocked(false→true)，认领失败=已锁过（支付事件重放/并发二次入厅），
     * 直接返回 true 不再递增容量；若容量已满则回滚认领，避免取消时误减造成容量虚增。
     */
    lock(ctx: RequestContext, order: Order | null): Promise<boolean>;
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 原子认领 slotLocked=true → false，保证「同一单只释放一次」，且未锁位/锁位失败的单一律不释放。
     * 返回 true 表示本次确实归还了一个名额。
     */
    unlock(ctx: RequestContext, orderId: number): Promise<boolean>;
}
