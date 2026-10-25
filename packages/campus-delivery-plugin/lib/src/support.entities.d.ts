import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 客服工单（站内留言，非实时 IM）：顾客提交 → 运营回复 → 关闭。 */
export declare class CampusSupportTicket extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    customerId: ID;
    orderCode: string | null;
    /** order / delivery / refund / invoice / other */
    category: string;
    content: string;
    /** 图片 URL 列表（simple-array，逗号分隔） */
    images: string[] | null;
    /** open / replied / closed */
    status: string;
    reply: string | null;
    repliedBy: string | null;
    repliedAt: Date | null;
    constructor(input?: DeepPartial<CampusSupportTicket>);
}
/** 骑手申诉：信用扣分申诉单，后台审核通过后回补信用分。 */
export declare class CampusRiderAppeal extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    riderCustomerId: ID;
    orderId: number | null;
    orderCode: string | null;
    reason: string;
    images: string[] | null;
    /** pending / approved / rejected */
    status: string;
    /** 审核通过时回补的信用分（正数） */
    creditDelta: number;
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    constructor(input?: DeepPartial<CampusRiderAppeal>);
}
/** 下单黑名单：user（customerId）/ phone。命中后在支付前置闸门拦截。 */
export declare class CampusBlacklist extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    /** user / phone */
    type: string;
    customerId: number | null;
    phone: string | null;
    reason: string | null;
    createdBy: string | null;
    active: boolean;
    constructor(input?: DeepPartial<CampusBlacklist>);
}
