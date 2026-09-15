import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class ReconciliationBatch extends VendureEntity {
    constructor(input?: DeepPartial<ReconciliationBatch>);
    tenantChannelId: ID;
    date: string;
    status: string;
    d1Count: number;
    d2Count: number;
    d3Count: number;
    d4Count: number;
    orderTotal: number;
    trigger: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
}
export declare class ReconciliationOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<ReconciliationOrderLine>);
    batchId: ID;
    orderId: ID;
    diffTypes: string;
    status: string;
    remark?: string | null;
    fixedAt?: Date | null;
    fixerId?: string | null;
}
