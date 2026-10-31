import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
export declare class SlotLockService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 支付成功后锁位：先原子「容量 +1」（UPDATE ... WHERE lockedCount < capacity），
     * 再原子认领订单 slotLocked(false→true)；认领失败=支付事件重放/并发二次入厅，归还本次多占容量后返回 true。
     * 先占容量再接单可消除旧实现的竞态窗口：旧实现先认领标记、后判容量，若容量已满再回滚标记，
     * 期间并发事件看到「已认领」会错误返回 true，最终订单未占位却按已锁位入厅（时段超额）。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     */
    lock(ctx: RequestContext, order: Order | null): Promise<boolean>;
    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 原子认领 slotLocked=true → false，保证「同一单只释放一次」，且未锁位/锁位失败的单一律不释放。
     * 返回 true 表示本次确实归还了一个名额。
     */
    unlock(ctx: RequestContext, orderId: number): Promise<boolean>;
}
