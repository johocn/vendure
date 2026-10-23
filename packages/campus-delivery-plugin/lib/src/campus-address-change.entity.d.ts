import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 改址台账：顾客下单后修改配送地址产生的运费差额（多退少补）。
 * 差额不阻塞改址，运营在后台统一退款/补收后标记结清。
 */
export declare class CampusAddressChange extends VendureEntity {
    channelId: ID;
    orderId: ID;
    orderCode: string;
    customerId: ID | null;
    fromZone: string;
    fromBuilding: string;
    fromDetail: string | null;
    toZone: string;
    toBuilding: string;
    toDetail: string | null;
    oldFee: number;
    newFee: number;
    diff: number;
    /** pending | settled | waived */
    status: string;
    settledAt: Date | null;
    settledBy: ID | null;
    /** refund=已退顾客 | collect=已补收 | waive=免收 */
    settleAction: string | null;
    constructor(input?: DeepPartial<CampusAddressChange>);
}
