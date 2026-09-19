import { ID, RequestContext } from '@vendure/core';
import { StockDocService, StockDocCreateInput } from './stock-doc.service';
/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 */
export declare class StockDocAdminResolver {
    private stockDocService;
    constructor(stockDocService: StockDocService);
    createStockDoc(ctx: RequestContext, input: StockDocCreateInput): Promise<any>;
    stockMovementLedger(ctx: RequestContext, productVariantId?: ID, locationId?: ID, bizCode?: string, orderLineId?: ID, page?: number, pageSize?: number): Promise<any>;
}
