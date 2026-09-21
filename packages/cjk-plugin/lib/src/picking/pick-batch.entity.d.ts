import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { PickBatchOrder } from './pick-batch-order.entity';
/** 拣货批次状态。SHIPPED / CANCELLED 为终态。 */
export type PickBatchState = 'PENDING' | 'PICKED' | 'PRINTED' | 'SHIPPED' | 'CANCELLED';
export declare class PickBatch extends VendureEntity {
    constructor(input?: DeepPartial<PickBatch>);
    /** 批次号，格式 PB20260922-001（日期 + 当日 3 位序号） */
    code: string;
    /** 归属租户渠道，用于 scoping */
    tenantChannelId: string;
    /** 目标发货仓（一个批次锁一个仓） */
    stockLocationId: number;
    state: PickBatchState;
    note: string | null;
    /** 创建人，优先取 TenantMember.displayName */
    createdBy: string | null;
    pickedAt: Date | null;
    printedAt: Date | null;
    shippedAt: Date | null;
    orders: PickBatchOrder[];
}
