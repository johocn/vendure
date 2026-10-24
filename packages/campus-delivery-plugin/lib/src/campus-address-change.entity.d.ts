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
    /** 结清凭证：补收的收款方式/流水号，退款/免收的说明（补收必填） */
    settleNote: string | null;
    /** 实际退款单 id（action=refund 且差额>0 时写入，便于财务对账） */
    refundId: ID | null;
    /** customer=顾客自助 | admin=运营代改 */
    source: string | null;
    /** 代改原因（运营代改必填，顾客自助可空） */
    reason: string | null;
    /** 发起改址的用户 id（顾客=本人，运营=管理员） */
    changedBy: ID | null;
    constructor(input?: DeepPartial<CampusAddressChange>);
}
