import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 拆单包裹（追溯底座）：一个包 = 一个出货仓的履约单元，落库拆单确认时的 SplitPackage */
export declare class OrderPackage extends VendureEntity {
    constructor(input?: DeepPartial<OrderPackage>);
    /** 包号，沿用现有命名 P1/P2 */
    code: string;
    /** 所属订单 */
    orderId: ID;
    /** 出货仓（一个包 = 一个出货仓的履约单元） */
    stockLocationId: ID;
    /** 包内行明细 [{ orderLineId, quantity }]（结构复用 SplitLine） */
    linesJson: string | null;
    /** 本包运费（分）：确认时=估算值，发货后回填实际值 */
    shippingFee: number | null;
    /** 配送模式 'self' | 'city'（自有司机 / 同城配送） */
    deliveryMode: string;
    /** 关联发货记录（发货回填） */
    fulfillmentId: ID | null;
    /** 关联配送单 DeliveryOrder（同城配送回填） */
    deliveryOrderId: ID | null;
}
