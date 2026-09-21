import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { PickBatch } from './pick-batch.entity';
export declare class PickBatchOrder extends VendureEntity {
    constructor(input?: DeepPartial<PickBatchOrder>);
    batchId: number;
    batch: PickBatch;
    /** Vendure Order.id */
    orderId: number;
    addedAt: Date;
}
