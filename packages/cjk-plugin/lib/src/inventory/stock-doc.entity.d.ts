export type StockDocType = 'PURCHASE' | 'TRANSFER' | 'STOCKTAKE' | 'ISSUE';
export declare class StockDocEntity {
    id: number;
    type: string;
    tenantChannelId: string;
    code: string;
    remark: string;
    operator: string;
    createdAt: Date;
}
