import { ID, RequestContext } from '@vendure/core';
import { ReconciliationService } from './reconciliation.service';
export declare class ReconciliationAdminResolver {
    private reconciliationService;
    constructor(reconciliationService: ReconciliationService);
    reconciliationBatches(ctx: RequestContext): Promise<import("./reconciliation.entity").ReconciliationBatch[]>;
    reconciliationLines(ctx: RequestContext, batchId: ID): Promise<import("./reconciliation.entity").ReconciliationOrderLine[]>;
    runReconciliation(ctx: RequestContext, date: string, trigger?: string): Promise<import("./reconciliation.entity").ReconciliationBatch | null>;
    rerunReconciliationOrder(ctx: RequestContext, lineId: ID): Promise<import("./reconciliation.entity").ReconciliationOrderLine>;
}
