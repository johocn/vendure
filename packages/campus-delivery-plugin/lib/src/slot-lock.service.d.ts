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
}
