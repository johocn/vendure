import { ID, RequestContext } from '@vendure/core';
import { R2MarkService } from './r2-mark.service';
export declare class R2ShopResolver {
    private r2;
    constructor(r2: R2MarkService);
    /** R2 原单卡「接力单状态」子卡数据源（动态反查，无写回） */
    campusR2Relay(ctx: RequestContext, orderId: ID): Promise<{
        orderId: ID;
        orderCode: string;
        state: import("@vendure/core").OrderState;
        hallStatus: any;
        deliveryStatus: any;
        errandTo: any;
        tip: any;
        totalWithTax: number;
    } | null>;
}
