import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 声望/情报流水。幂等键 (customerId + reason + taskId + channelId) 唯一索引，
 * 防止核销/审核重放导致重复入账（事务内唯一冲突即视为已处理）。
 */
export declare class JianghuRecord extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuRecord>);
    customerId: number;
    taskId: string | null;
    /** 幂等键 */
    idempotentKey: string;
    reason: string;
    reasonText: string | null;
    deltaRep: number;
    deltaIntel: number | null;
    snapshotRep: number | null;
    channelId: string | null;
}
