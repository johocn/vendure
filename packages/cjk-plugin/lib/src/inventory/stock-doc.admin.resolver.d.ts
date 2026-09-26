import { ID, RequestContext } from '@vendure/core';
import { StockDocCreateInput, StockDocService } from './stock-doc.service';
/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 + 单据中心列表 */
export declare class StockDocAdminResolver {
    private stockDocService;
    constructor(stockDocService: StockDocService);
    createStockDoc(ctx: RequestContext, input: StockDocCreateInput): Promise<any>;
    stockMovementLedger(ctx: RequestContext, productVariantId?: ID, locationId?: ID, bizCode?: string, orderLineId?: ID, bizType?: string, direction?: string, from?: string, to?: string, page?: number, pageSize?: number): Promise<any>;
    stockDocList(ctx: RequestContext, type?: string, locationId?: ID, from?: string, to?: string, operator?: string, page?: number, pageSize?: number): Promise<any>;
    /** 作业员明细聚合（D46）：服务端 GROUP BY 操作人，绕开 listDocs 的 pageSize ≤ 100 硬上限 */
    stockDocOperatorStats(ctx: RequestContext, from?: string, to?: string): Promise<any>;
}
