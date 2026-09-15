import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ReconciliationBatch, ReconciliationOrderLine } from './reconciliation.entity';
export declare class ReconciliationService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 幂等跑批：同日已有 done 批次则返回 null */
    runBatch(ctx: RequestContext, date: string, trigger: 'manual' | 'cron'): Promise<ReconciliationBatch | null>;
    /** 采集一单四流数据（数据源：Order / OrderStockLedger / DeliveryRecord / MerchantSettlementLedger） */
    private collectOrderData;
    /** 重跑单条：重新判定后置 closed */
    rerunOrder(ctx: RequestContext, lineId: ID): Promise<ReconciliationOrderLine>;
    listBatches(ctx: RequestContext): Promise<ReconciliationBatch[]>;
    listLines(ctx: RequestContext, batchId: ID): Promise<ReconciliationOrderLine[]>;
}
